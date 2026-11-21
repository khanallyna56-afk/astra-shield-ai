"""Current fused risk and history."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import services as svc
from app.config import get_settings
from app.db import get_session

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/current")
async def current(session: AsyncSession = Depends(get_session)) -> dict:
    rows, state = await svc.crew_risk(session)
    s = get_settings()
    return {"ts": state["ts"], "crew": rows,
            "formula": {"w_radiation": s.risk_w_radiation, "w_sleep": s.risk_w_sleep,
                        "green_below": s.green_below, "red_at_or_above": s.red_at_or_above}}


@router.get("/history")
async def history(hours: int = Query(24, gt=0, le=168), session: AsyncSession = Depends(get_session)) -> list[dict]:
    return await svc.risk_history(session, hours)
