"""Space engine: orbit propagation, day/night (eclipse), South Atlantic Anomaly, solar flares.

Science notes
-------------
* Orbit: SGP4 propagation of a Two-Line Element set via Skyfield. The ISS TLE is
  used as a *labelled stand-in* for a Gaganyaan-class LEO (~400 km, 51.6 deg); no
  public Gaganyaan TLE exists.
* Eclipse: Skyfield ``is_sunlit`` against the JPL DE421 ephemeris when available
  (bundled in the Docker image). Without it, a cylindrical Earth-shadow model with
  a low-precision analytic Sun vector (accurate to ~0.01 deg) is used.
* SAA: the inner Van Allen belt dips closest to Earth over the South Atlantic,
  so LEO crews receive most of their trapped-proton dose there. We model it as a
  configurable lat/lon polygon plus a smooth Gaussian intensity (0..1) peaking
  near (-25, -50). This is a design approximation, not an AP-8/AP-9 flux model.
* Flares: GOES 1-8 Angstrom X-ray flux classes (A < 1e-7 <= B < 1e-6 <= C < 1e-5
  <= M < 1e-4 <= X, in W/m^2). X-rays arrive at light speed, so a flare is a
  *detection* of elevated solar-particle-event likelihood, not a dose itself.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import numpy as np
from skyfield.api import EarthSatellite, load, wgs84

from app.config import get_settings

EARTH_RADIUS_KM = 6371.0
STALE_TLE_DAYS = 14
ts = load.timescale(builtin=True)

FLARE_FACTOR = {"A": 0.0, "B": 0.0, "C": 0.2, "M": 0.6, "X": 1.0}
FLARE_THRESHOLDS = (("X", 1e-4), ("M", 1e-5), ("C", 1e-6), ("B", 1e-7), ("A", 1e-8))


# --------------------------------------------------------------------- flares
def classify_flare(flux_wm2: float | None) -> str:
    """GOES class string (e.g. 'M2.4') from 1-8 A flux in W/m^2. 'A0.0' for <=0/None."""
    if not flux_wm2 or flux_wm2 <= 0:
        return "A0.0"
    for letter, lim in FLARE_THRESHOLDS:
        if flux_wm2 >= lim:
            return f"{letter}{flux_wm2 / lim:.1f}"
    return f"A{flux_wm2 / 1e-8:.1f}"


def flare_factor(flare_class: str) -> float:
    """Map a GOES class to a 0..1 radiation-hazard factor: C=0.2, M=0.6, X=1.0, A/B=0."""
    return FLARE_FACTOR.get((flare_class or "A")[0].upper(), 0.0)


# ------------------------------------------------------------------------ SAA
def point_in_polygon(lat: np.ndarray, lon: np.ndarray, poly: list[tuple[float, float]]) -> np.ndarray:
    """Vectorised even-odd ray casting. ``poly`` is a list of (lat, lon) vertices."""
    lat, lon = np.atleast_1d(lat).astype(float), np.atleast_1d(lon).astype(float)
    inside = np.zeros(lat.shape, dtype=bool)
    n = len(poly)
    for i in range(n):
        y1, x1 = poly[i]
        y2, x2 = poly[(i + 1) % n]
        crosses = (y1 > lat) != (y2 > lat)
        with np.errstate(divide="ignore", invalid="ignore"):
            x_int = (x2 - x1) * (lat - y1) / (y2 - y1) + x1
        inside ^= crosses & (lon < x_int)
    return inside


def saa_intensity(lat, lon) -> np.ndarray:
    """Smooth 0..1 SAA intensity: Gaussian around the configured peak, zero outside the polygon.

    Widths (sigma) of 15 deg latitude and 35 deg longitude reflect the SAA's
    east-west elongation at ~400 km.
    """
    s = get_settings()
    lat, lon = np.atleast_1d(lat).astype(float), np.atleast_1d(lon).astype(float)
    plat, plon = s.saa_peak
    g = np.exp(-(((lat - plat) / 15.0) ** 2 + ((lon - plon) / 35.0) ** 2))
    return np.where(point_in_polygon(lat, lon, s.saa_polygon), g, 0.0)


# ------------------------------------------------------------------ geometry
def _sun_unit_vectors(t) -> np.ndarray:
    """Low-precision solar direction in GCRS (Astronomical Almanac formula, ~0.01 deg)."""
    n = np.atleast_1d(t.tt) - 2451545.0
    L = np.radians((280.460 + 0.9856474 * n) % 360)
    g = np.radians((357.528 + 0.9856003 * n) % 360)
    lam = L + np.radians(1.915) * np.sin(g) + np.radians(0.020) * np.sin(2 * g)
    eps = np.radians(23.439 - 0.0000004 * n)
    return np.array([np.cos(lam), np.cos(eps) * np.sin(lam), np.sin(eps) * np.sin(lam)])


def _sunlit_analytic(r_km: np.ndarray, sun_u: np.ndarray) -> np.ndarray:
    """Cylindrical shadow: in eclipse if behind Earth and within one Earth radius of the axis."""
    r_km = r_km.reshape(3, -1)
    proj = np.sum(r_km * sun_u, axis=0)
    perp = np.linalg.norm(r_km - proj * sun_u, axis=0)
    return ~((proj < 0) & (perp < EARTH_RADIUS_KM))


@lru_cache(maxsize=1)
def _ephemeris(path: str):
    return load(path) if path and os.path.exists(path) else None


# -------------------------------------------------------------------- engine
@dataclass
class OrbitPoint:
    ts: datetime
    lat: float
    lon: float
    alt_km: float
    sunlit: bool
    in_saa: bool
    saa_intensity: float


class SpaceEngine:
    """Orbit/eclipse/SAA calculator for one TLE."""

    def __init__(self, name: str, line1: str, line2: str, source: str = "fixture"):
        self.sat = EarthSatellite(line1, line2, name, ts)
        self.source = source
        self.eph = _ephemeris(get_settings().ephemeris_path)

    @property
    def epoch(self) -> datetime:
        return self.sat.epoch.utc_datetime()

    @property
    def tle_age_days(self) -> float:
        return abs((datetime.now(UTC) - self.epoch).total_seconds()) / 86400

    @property
    def orbits_per_day(self) -> float:
        """Mean motion in revolutions/day (= orbital sunrises per day, ~15.5 for the ISS)."""
        return round(self.sat.model.no_kozai * 1440 / (2 * np.pi), 4)

    @property
    def eclipse_model(self) -> str:
        return "skyfield.is_sunlit + DE421" if self.eph is not None else "analytic cylindrical shadow"

    def reference_time(self) -> datetime:
        """Real 'now', or the TLE epoch if the TLE is too old for SGP4 to be trusted."""
        if self.tle_age_days > STALE_TLE_DAYS:
            return self.epoch.replace(microsecond=0)
        return datetime.now(UTC).replace(microsecond=0)

    # -- vectorised core --------------------------------------------------
    def _compute(self, times: list[datetime]) -> list[OrbitPoint]:
        t = ts.from_datetimes(times)
        geo = self.sat.at(t)
        sp = wgs84.subpoint_of(geo)
        lat = np.atleast_1d(sp.latitude.degrees)
        lon = np.atleast_1d(sp.longitude.degrees)
        alt = np.atleast_1d(wgs84.height_of(geo).km)
        if self.eph is not None:
            sunlit = np.atleast_1d(geo.is_sunlit(self.eph))
        else:
            sunlit = _sunlit_analytic(geo.position.km, _sun_unit_vectors(t))
        inten = saa_intensity(lat, lon)
        in_saa = point_in_polygon(lat, lon, get_settings().saa_polygon)
        return [
            OrbitPoint(times[i], round(float(lat[i]), 3), round(float(lon[i]), 3), round(float(alt[i]), 2),
                       bool(sunlit[i]), bool(in_saa[i]), round(float(inten[i]), 3))
            for i in range(len(times))
        ]

    # -- public API -------------------------------------------------------
    def state_at(self, when: datetime) -> OrbitPoint:
        return self._compute([when])[0]

    def current_state(self) -> OrbitPoint:
        return self.state_at(self.reference_time())

    def ground_track(self, hours: float = 24, start: datetime | None = None, step_s: int = 60) -> list[OrbitPoint]:
        """Sub-satellite points every ``step_s`` seconds for ``hours`` hours (1441 points for 24 h)."""
        start = (start or self.reference_time()).replace(microsecond=0)
        return _cached_track(self, start, hours, step_s)

    def predict_saa_passes(self, hours: float = 24, start: datetime | None = None) -> list[dict]:
        """Significant SAA passes: [{start, end, peak_intensity, duration_min}].

        A pass is a contiguous in-polygon window whose peak intensity reaches
        ``saa_pass_min_peak``; shallow edge clips are ignored (~8 passes/day).
        """
        min_peak = get_settings().saa_pass_min_peak
        return [p for p in saa_windows(self.ground_track(hours, start)) if p["peak_intensity"] >= min_peak]

    def sunrise_count(self, hours: float = 24, start: datetime | None = None) -> int:
        """Number of eclipse->sunlit transitions (orbital sunrises); ~16 per day in LEO."""
        track = self.ground_track(hours, start)
        return sum(1 for a, b in zip(track, track[1:]) if not a.sunlit and b.sunlit)

    def eclipse_windows(self, hours: float = 24, start: datetime | None = None) -> list[dict]:
        track = self.ground_track(hours, start)
        return _windows(track, lambda p: not p.sunlit)


_track_cache: dict[tuple, list[OrbitPoint]] = {}


def _cached_track(engine: SpaceEngine, start: datetime, hours: float, step_s: int) -> list[OrbitPoint]:
    """Cache per (TLE epoch, start minute, span). Bounded to a few entries."""
    key = (engine.sat.model.satnum, engine.epoch, start.replace(second=0), hours, step_s)
    if key not in _track_cache:
        if len(_track_cache) > 8:
            _track_cache.clear()
        n = int(hours * 3600 / step_s) + 1
        times = [start + timedelta(seconds=i * step_s) for i in range(n)]
        _track_cache[key] = engine._compute(times)
    return _track_cache[key]


def _windows(track: list[OrbitPoint], pred) -> list[dict]:
    out, cur = [], None
    for p in track:
        if pred(p):
            cur = cur or {"start": p.ts, "points": []}
            cur["points"].append(p)
        elif cur:
            cur["end"] = p.ts
            out.append(cur)
            cur = None
    if cur:
        cur["end"] = track[-1].ts
        out.append(cur)
    return out


def saa_windows(track: list[OrbitPoint]) -> list[dict]:
    res = []
    for w in _windows(track, lambda p: p.in_saa):
        res.append({
            "start": w["start"],
            "end": w["end"],
            "peak_intensity": round(max(p.saa_intensity for p in w["points"]), 3),
            "duration_min": round((w["end"] - w["start"]).total_seconds() / 60, 1),
        })
    return res


def next_saa_pass(passes: list[dict], now: datetime) -> dict | None:
    """The active pass (if now is inside one) or the next upcoming pass."""
    for p in passes:
        if p["end"] > now:
            return p
    return None


def minutes_until(when: datetime, now: datetime) -> float:
    return max(0.0, (when - now).total_seconds() / 60)

