"""Orbit, SAA and solar flare endpoints."""
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import services as svc
from app.config import get_settings
from app.data import flare_client
from app.db import get_session

router = APIRouter(prefix="/api/space", tags=["space"])
FLARE_BANDS = (("A", 1e-8), ("B", 1e-7), ("C", 1e-6), ("M", 1e-5), ("X", 1e-4))


@router.get("/state")
async def state(session: AsyncSession = Depends(get_session)) -> dict:
    return await svc.space_state(session)


@router.get("/groundtrack")
async def groundtrack(hours: float = Query(24, gt=0, le=48), step_s: int = Query(60, ge=30, le=600),
                      session: AsyncSession = Depends(get_session)) -> dict:
    eng = await svc.get_engine(session)
    start = svc.mission_now(eng).replace(second=0)
    track = eng.ground_track(hours, start, step_s)
    return {
        "start": svc.iso(track[0].ts), "step_s": step_s,
        "points": [{"ts": svc.iso(p.ts), "lat": p.lat, "lon": p.lon, "alt_km": p.alt_km, "sunlit": p.sunlit,
                    "in_saa": p.in_saa, "saa_intensity": p.saa_intensity} for p in track],
        "saa_polygon": [{"lat": la, "lon": lo} for la, lo in get_settings().saa_polygon],
        "eclipse_windows": [{"start": svc.iso(w["start"]), "end": svc.iso(w["end"])}
                            for w in eng.eclipse_windows(hours, start)],
    }


@router.get("/saa-passes")
async def saa_passes(hours: float = Query(24, gt=0, le=48),
                     session: AsyncSession = Depends(get_session)) -> list[dict]:
    eng = await svc.get_engine(session)
    now = svc.mission_now(eng)
    passes = eng.predict_saa_passes(hours, (now - timedelta(minutes=30)).replace(second=0))
    return [{"start": svc.iso(p["start"]), "end": svc.iso(p["end"]), "peak_intensity": p["peak_intensity"],
             "duration_min": p["duration_min"]} for p in passes if p["end"] > now]


@router.get("/flares")
async def flares(session: AsyncSession = Depends(get_session)) -> dict:
    data = await flare_client.get_flares(session)
    series = data["series"]
    return {
        "source": data["source"], "instrument": data.get("instrument"), "units": data.get("units"),
        "series": series[::5] if len(series) > 600 else series,
        "current": await svc.flare_now(session),
        "class_bands": [{"class": c, "min_flux": f} for c, f in FLARE_BANDS],
    }
