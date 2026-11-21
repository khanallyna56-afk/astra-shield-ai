"""Solar X-ray flux source.

Priority:
1. Aditya-L1 SoLEXS export from ISRO PRADAN: any CSV in ``app/data/aditya/`` with
   columns ``time, flux`` (optional ``unit``). Manual download (login required).
2. NOAA SWPC GOES primary XRS 1-8 A (live, 5 min cache in data_cache).
3. Bundled GOES fixture (offline).

Returns a series of {time, flux} plus metadata. Flux units: W/m^2 for GOES; for
Aditya-L1 the file's own unit (counts/s for SoLEXS), so classification is only
applied to W/m^2 data.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import httpx
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.data.cache import get_any, get_cached, set_cached

log = logging.getLogger(__name__)
SWPC_URL = "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json"
FIXTURE = Path(__file__).parent / "fixtures" / "flares_sample.json"
ADITYA_DIR = Path(__file__).parent / "aditya"
CACHE_KEY = "goes:xrs:1day"


def parse_goes(rows: list[dict]) -> list[dict]:
    """Keep the long-wavelength (0.1-0.8 nm = 1-8 A) channel, sorted by time."""
    out = [
        {"time": r["time_tag"], "flux": float(r["flux"])}
        for r in rows
        if r.get("energy") == "0.1-0.8nm" and r.get("flux") is not None
    ]
    return sorted(out, key=lambda r: r["time"])


def load_aditya(directory: Path = ADITYA_DIR) -> dict | None:
    """Load the newest user-provided Aditya-L1 CSV, if any."""
    files = sorted(directory.glob("*.csv"), key=lambda p: p.stat().st_mtime) if directory.exists() else []
    if not files:
        return None
    df = pd.read_csv(files[-1])
    df.columns = [c.strip().lower() for c in df.columns]
    times = pd.to_datetime(df[df.columns[0]], utc=True, errors="coerce")
    flux = pd.to_numeric(df[df.columns[1]], errors="coerce")
    unit = str(df["unit"].iloc[0]) if "unit" in df.columns else "counts/s"
    series = [
        {"time": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "flux": float(f)}
        for t, f in zip(times, flux) if pd.notna(t) and pd.notna(f)
    ]
    return {"series": series, "source": "ISRO PRADAN", "instrument": "Aditya-L1 SoLEXS",
            "units": unit, "file": files[-1].name}


def load_fixture() -> dict:
    return {"series": parse_goes(json.loads(FIXTURE.read_text())), "source": "NOAA SWPC (offline fixture)",
            "instrument": "GOES XRS 1-8 A", "units": "W/m^2"}


async def fetch_live(timeout: float = 8.0) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.get(SWPC_URL)
        r.raise_for_status()
        series = parse_goes(r.json())
        if not series:
            raise ValueError("empty GOES payload")
        return {"series": series, "source": "NOAA SWPC (live)", "instrument": "GOES XRS 1-8 A", "units": "W/m^2"}


async def get_flares(session: AsyncSession | None = None) -> dict:
    """Return {series, source, instrument, units}. Never raises."""
    if aditya := load_aditya():
        return aditya
    if get_settings().data_mode != "live":
        return load_fixture()
    if session is not None and (cached := await get_cached(session, CACHE_KEY, get_settings().flare_ttl_s)):
        return {**cached, "source": "NOAA SWPC (cached)"}
    try:
        data = await fetch_live()
        if session is not None:
            await set_cached(session, CACHE_KEY, data)
        return data
    except Exception as exc:
        log.warning("SWPC fetch failed (%s); using fallback", exc)
        if session is not None and (stale := await get_any(session, CACHE_KEY)):
            return {**stale, "source": "NOAA SWPC (stale cache)"}
        return load_fixture()


def latest(data: dict) -> dict:
    """Most recent {time, flux} point, or zeros if the series is empty."""
    return data["series"][-1] if data.get("series") else {"time": None, "flux": 0.0}
