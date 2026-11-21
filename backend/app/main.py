"""ASTRA SHIELD AI: FastAPI entrypoint."""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session

settings = get_settings()

app = FastAPI(
    title="ASTRA SHIELD AI",
    version="0.1.0",
    description="Radiation + sleep compound-risk decision support. Prototype, not a medical device.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["system"])
async def health(session: AsyncSession = Depends(get_session)) -> dict:
    """Liveness + database connectivity check."""
    db_ok = True
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok, "data_mode": settings.data_mode}
