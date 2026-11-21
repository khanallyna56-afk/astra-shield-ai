"""Tiny key/value cache on the `data_cache` table (JSON payload + fetched_at)."""
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DataCache


def _aware(dt: datetime) -> datetime:
    """SQLite returns naive datetimes; treat them as UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


async def get_cached(session: AsyncSession, key: str, ttl_s: int) -> dict | None:
    row = await session.get(DataCache, key)
    if row and (datetime.now(UTC) - _aware(row.fetched_at)).total_seconds() < ttl_s:
        return row.payload
    return None


async def get_any(session: AsyncSession, key: str) -> dict | None:
    """Return a cached payload regardless of age (stale fallback)."""
    row = await session.get(DataCache, key)
    return row.payload if row else None


async def set_cached(session: AsyncSession, key: str, payload: dict) -> None:
    await session.merge(DataCache(key=key, payload=payload, fetched_at=datetime.now(UTC)))
    await session.commit()
