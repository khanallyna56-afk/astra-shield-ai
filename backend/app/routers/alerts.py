"""Alerts log and acknowledgement."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import services as svc
from app.db import get_session
from app.models import Alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
async def alerts(limit: int = Query(200, gt=0, le=1000), session: AsyncSession = Depends(get_session)) -> list[dict]:
    return await svc.list_alerts(session, limit)


@router.post("/{alert_id}/ack")
async def ack(alert_id: int, session: AsyncSession = Depends(get_session)) -> dict:
    a = await session.get(Alert, alert_id)
    if a is None:
        raise HTTPException(404, "alert not found")
    a.acknowledged = True
    await session.commit()
    return svc.alert_json(a)
