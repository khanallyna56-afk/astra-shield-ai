"""24 h crew schedule: baseline vs latest re-plan."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import services as svc
from app.db import get_session
from app.routers.ws import manager

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


@router.get("")
async def get_schedule(version: str = Query("latest", pattern="^(baseline|latest)$"),
                       session: AsyncSession = Depends(get_session)) -> dict:
    v = 0 if version == "baseline" else await svc.latest_version(session)
    return await svc.schedule_payload(session, v)


@router.post("/replan")
async def replan(session: AsyncSession = Depends(get_session)) -> dict:
    out = await svc.replan(session)
    await manager.broadcast({"type": "schedule", "version": out["version"]})
    return out
