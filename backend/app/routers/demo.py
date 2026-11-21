"""Demo scenario: X-class flare during an SAA pass (deterministic)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app import services as svc
from app.db import get_session
from app.routers.ws import manager

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/solar-flare")
async def solar_flare(session: AsyncSession = Depends(get_session)) -> dict:
    out = await svc.run_demo(session)
    await manager.broadcast(out.pop("live"))          # push risk + alerts + space state immediately
    await manager.broadcast({"type": "demo", "scenario": out["scenario"]})
    return out


@router.post("/reset")
async def reset(session: AsyncSession = Depends(get_session)) -> dict:
    live = await svc.reset_demo(session)
    await manager.broadcast(live)
    await manager.broadcast({"type": "demo", "scenario": None})
    return {"reset": True}
