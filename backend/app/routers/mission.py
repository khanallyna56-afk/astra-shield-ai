"""Mission overview: everything the landing page needs in one call."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app import services as svc
from app.db import get_session

router = APIRouter(prefix="/api/mission", tags=["mission"])


@router.get("/overview")
async def overview(session: AsyncSession = Depends(get_session)) -> dict:
    p = await svc.live_payload(session)
    p["top_actions"] = p["actions"][:5]
    return p
