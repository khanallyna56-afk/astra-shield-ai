"""TLE source: CelesTrak (live) -> data_cache (6 h TTL, then stale) -> bundled fixture.

The ISS (NORAD 25544) is a labelled stand-in for a Gaganyaan-class orbit.
"""
from __future__ import annotations

import logging
from pathlib import Path

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.data.cache import get_any, get_cached, set_cached

log = logging.getLogger(__name__)
CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle"
FIXTURE = Path(__file__).parent / "fixtures" / "iss.tle"
CACHE_KEY = "tle:25544"


def parse_tle(text: str) -> dict:
    """Parse a 3-line (name + 2 lines) TLE block. Raises ValueError if malformed."""
    lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]
    if len(lines) == 2:
        lines = ["SAT", *lines]
    if len(lines) < 3 or not lines[1].startswith("1 ") or not lines[2].startswith("2 "):
        raise ValueError("not a valid TLE")
    return {"name": lines[0], "line1": lines[1], "line2": lines[2]}


def load_fixture() -> dict:
    return {**parse_tle(FIXTURE.read_text()), "source": "fixture (offline ISS TLE)"}


async def fetch_live(timeout: float = 8.0) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.get(CELESTRAK_URL)
        r.raise_for_status()
        return {**parse_tle(r.text), "source": "CelesTrak (live)"}


async def get_tle(session: AsyncSession | None = None) -> dict:
    """Return {name, line1, line2, source}. Never raises: falls back to the fixture."""
    if get_settings().data_mode != "live":
        return load_fixture()
    if session is not None:
        cached = await get_cached(session, CACHE_KEY, get_settings().tle_ttl_s)
        if cached:
            return {**cached, "source": "CelesTrak (cached)"}
    try:
        tle = await fetch_live()
        if session is not None:
            await set_cached(session, CACHE_KEY, tle)
        return tle
    except Exception as exc:  # network down, HTTP error, bad payload
        log.warning("CelesTrak fetch failed (%s); using fallback", exc)
        if session is not None and (stale := await get_any(session, CACHE_KEY)):
            return {**stale, "source": "CelesTrak (stale cache)"}
        return load_fixture()
