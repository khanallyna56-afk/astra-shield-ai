from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from app.config import get_settings
from app.data import flare_client, tle_client
from app.engines import space
from app.engines.space import SpaceEngine, classify_flare, flare_factor, point_in_polygon, saa_intensity

START = datetime(2026, 11, 21, 18, 0, tzinfo=UTC)   # close to the fixture TLE epoch


@pytest.fixture(scope="module")
def engine():
    t = tle_client.load_fixture()
    return SpaceEngine(t["name"], t["line1"], t["line2"], t["source"])


# ---- flares ------------------------------------------------------------------
@pytest.mark.parametrize("flux,cls", [
    (3e-8, "A3.0"), (2.5e-7, "B2.5"), (4e-6, "C4.0"), (1.2e-5, "M1.2"), (2.1e-4, "X2.1"), (0, "A0.0"), (None, "A0.0"),
])
def test_classify_flare(flux, cls):
    assert classify_flare(flux) == cls


@pytest.mark.parametrize("cls,f", [("A1.0", 0.0), ("B5.0", 0.0), ("C3.0", 0.2), ("M2.0", 0.6), ("X1.5", 1.0), ("", 0.0)])
def test_flare_factor(cls, f):
    assert flare_factor(cls) == f


# ---- SAA ---------------------------------------------------------------------
def test_saa_polygon_membership():
    lat = np.array([-25.0, 40.0, -10.0, -60.0, -25.0])
    lon = np.array([-50.0, 0.0, 30.0, -50.0, 100.0])
    assert point_in_polygon(lat, lon, get_settings().saa_polygon).tolist() == [True, False, True, False, False]


def test_saa_intensity_peaks_at_center_and_zero_outside():
    assert saa_intensity(-25.0, -50.0)[0] == pytest.approx(1.0)
    assert saa_intensity(40.0, 0.0)[0] == 0.0
    edge, mid = saa_intensity(-5.0, 30.0)[0], saa_intensity(-20.0, -40.0)[0]
    assert 0 < edge < mid < 1


# ---- orbit -------------------------------------------------------------------
def test_state_is_plausible_leo(engine):
    s = engine.state_at(START)
    assert abs(s.lat) <= 52.0
    assert -180 <= s.lon <= 180
    assert 380 < s.alt_km < 450


def test_ground_track_is_24h_at_60s(engine):
    track = engine.ground_track(24, START)
    assert len(track) == 1441
    assert track[-1].ts - track[0].ts == timedelta(hours=24)
    assert engine.ground_track(24, START) is track  # cached


def test_saa_passes(engine):
    passes = engine.predict_saa_passes(24, START)
    assert 4 <= len(passes) <= 10
    for p in passes:
        assert p["peak_intensity"] >= get_settings().saa_pass_min_peak
        assert p["start"] < p["end"]
        assert 0 < p["peak_intensity"] <= 1
        assert p["duration_min"] > 0


def test_sunrise_count_matches_leo(engine):
    # ISS period ~92.9 min -> ~15.5 orbital sunrises per day
    assert 14 <= engine.sunrise_count(24, START) <= 17


def test_eclipse_fraction_is_plausible(engine):
    track = engine.ground_track(24, START)
    frac = sum(not p.sunlit for p in track) / len(track)
    assert 0.20 < frac < 0.45
    assert engine.eclipse_windows(24, START)


def test_next_saa_pass_and_minutes_until(engine):
    passes = engine.predict_saa_passes(24, START)
    nxt = space.next_saa_pass(passes, START)
    assert nxt is passes[0]
    assert space.next_saa_pass(passes, START + timedelta(days=2)) is None
    assert space.minutes_until(START + timedelta(minutes=30), START) == 30
    assert space.minutes_until(START - timedelta(minutes=5), START) == 0


def test_reference_time_uses_epoch_when_stale(engine, monkeypatch):
    monkeypatch.setattr(SpaceEngine, "tle_age_days", property(lambda self: 30.0))
    assert engine.reference_time() == engine.epoch.replace(microsecond=0)
    assert "analytic" in engine.eclipse_model or "DE421" in engine.eclipse_model


# ---- data clients ------------------------------------------------------------
def test_parse_tle_rejects_garbage():
    with pytest.raises(ValueError):
        tle_client.parse_tle("hello\nworld")
    assert tle_client.parse_tle("1 x\n2 y")["name"] == "SAT"


async def test_tle_offline_returns_fixture():
    t = await tle_client.get_tle()
    assert t["line1"].startswith("1 25544") and "fixture" in t["source"]


async def test_tle_live_falls_back_when_network_fails(monkeypatch, session):
    monkeypatch.setattr(get_settings(), "data_mode", "live")

    async def boom(*a, **k):
        raise OSError("no network")

    monkeypatch.setattr(tle_client, "fetch_live", boom)
    t = await tle_client.get_tle(session)
    assert "fixture" in t["source"]


async def test_tle_live_caches(monkeypatch, session):
    monkeypatch.setattr(get_settings(), "data_mode", "live")
    calls = {"n": 0}

    async def fake():
        calls["n"] += 1
        return {**tle_client.load_fixture(), "source": "CelesTrak (live)"}

    monkeypatch.setattr(tle_client, "fetch_live", fake)
    assert (await tle_client.get_tle(session))["source"] == "CelesTrak (live)"
    assert (await tle_client.get_tle(session))["source"] == "CelesTrak (cached)"
    assert calls["n"] == 1


async def test_flares_offline_fixture():
    d = await flare_client.get_flares()
    assert d["units"] == "W/m^2" and len(d["series"]) > 1000
    assert flare_client.latest(d)["flux"] > 0
    assert flare_client.latest({"series": []})["flux"] == 0.0


async def test_flares_live_falls_back_to_stale_cache(monkeypatch, session):
    monkeypatch.setattr(get_settings(), "data_mode", "live")
    monkeypatch.setattr(get_settings(), "flare_ttl_s", 0)
    from app.data.cache import set_cached
    await set_cached(session, flare_client.CACHE_KEY, {"series": [{"time": "t", "flux": 1e-6}], "source": "x",
                                                       "instrument": "GOES", "units": "W/m^2"})

    async def boom(*a, **k):
        raise OSError("down")

    monkeypatch.setattr(flare_client, "fetch_live", boom)
    d = await flare_client.get_flares(session)
    assert d["source"] == "NOAA SWPC (stale cache)"


def test_aditya_csv_loader(tmp_path):
    (tmp_path / "solexs.csv").write_text("time,flux,unit\n2026-11-20T00:00:00Z,120.5,counts/s\n"
                                         "2026-11-20T00:01:00Z,130.0,counts/s\n")
    d = flare_client.load_aditya(tmp_path)
    assert d["instrument"] == "Aditya-L1 SoLEXS"
    assert [p["flux"] for p in d["series"]] == [120.5, 130.0]
    assert flare_client.load_aditya(tmp_path / "missing") is None


def test_parse_goes_filters_channel():
    rows = [{"time_tag": "b", "flux": 2e-6, "energy": "0.1-0.8nm"},
            {"time_tag": "a", "flux": 1e-6, "energy": "0.1-0.8nm"},
            {"time_tag": "a", "flux": 9e-9, "energy": "0.05-0.4nm"}]
    assert flare_client.parse_goes(rows) == [{"time": "a", "flux": 1e-6}, {"time": "b", "flux": 2e-6}]
