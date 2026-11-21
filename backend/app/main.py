"""ASTRA SHIELD AI: FastAPI entrypoint (CORS, routers, startup tasks)."""
import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import services as svc
from app.config import get_settings
from app.db import SessionLocal, get_session
from app.routers import alerts, crew, demo, mission, risk, schedule, space, ws

settings = get_settings()
log = logging.getLogger("astra")
TICK_INTERVAL_S = 60


async def ticker() -> None:
    """Persist a snapshot (space, risk, new alerts) every minute and push it to WebSocket clients."""
    while True:
        try:
            async with SessionLocal() as session:
                payload = await svc.tick(session)
            await ws.manager.broadcast(payload)
        except Exception as exc:  # keep ticking on transient errors
            log.warning("tick failed: %s", exc)
        await asyncio.sleep(TICK_INTERVAL_S)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = None
    try:
        async with SessionLocal() as session:
            await svc.backfill_history(session)
    except Exception as exc:
        log.warning("history backfill skipped: %s", exc)
    if settings.ticker_enabled:
        task = asyncio.create_task(ticker())
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="ASTRA SHIELD AI",
    version="0.1.0",
    description="Radiation + sleep compound-risk decision support. Prototype, not a medical device. "
                "Crew data is simulated; formula weights are design choices, not clinically validated.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (mission, space, crew, risk, schedule, alerts, demo, ws):
    app.include_router(r.router)


@app.get("/api/health", tags=["system"])
async def health(session: AsyncSession = Depends(get_session)) -> dict:
    """Liveness + database connectivity check."""
    db_ok = True
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok, "data_mode": settings.data_mode}
