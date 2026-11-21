"""Crew list and per-astronaut readings (simulated)."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import services as svc
from app.db import get_session
from app.models import Astronaut, CrewReading

router = APIRouter(prefix="/api/crew", tags=["crew"])


@router.get("")
async def crew(session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows, _ = await svc.crew_risk(session)
    return rows


@router.get("/{astronaut_id}/readings")
async def readings(astronaut_id: int, hours: int = Query(72, gt=0, le=168),
                   session: AsyncSession = Depends(get_session)) -> dict:
    a = await session.get(Astronaut, astronaut_id)
    if a is None:
        raise HTTPException(404, "astronaut not found")
    last = (await session.execute(select(CrewReading.ts).where(CrewReading.astronaut_id == a.id)
                                  .order_by(CrewReading.ts.desc()).limit(1))).scalar()
    rows = []
    if last is not None:
        since = svc.aware(last) - timedelta(hours=hours)
        rows = (await session.execute(select(CrewReading).where(CrewReading.astronaut_id == a.id,
                                                                CrewReading.ts >= since)
                                      .order_by(CrewReading.ts))).scalars().all()
    history = next((h for h in await svc.risk_history(session, 24) if h["astronaut_id"] == a.id), None)
    return {
        "astronaut": {"id": a.id, "callsign": a.callsign, "name": a.name, "role": a.role,
                      "hrv_baseline": a.hrv_baseline, "location": a.location},
        "readings": [{"ts": svc.iso(r.ts), "sleep_hours": r.sleep_hours, "sleep_debt_h": r.sleep_debt_h,
                      "hrv_ms": r.hrv_ms, "fatigue_sp": r.fatigue_sp, "heart_rate": r.heart_rate} for r in rows],
        "dose": await svc.cumulative_dose(session, a),
        "risk_trend": history["points"] if history else [],
        "simulated": True,
    }
