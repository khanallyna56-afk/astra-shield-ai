"""Seed the database with 3 simulated astronauts, 72 h of readings and a 24 h baseline schedule.

Idempotent: does nothing if astronauts already exist, unless run with --reset.
Usage: python -m app.seed [--reset]
"""
import asyncio
import sys
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.crew_simulator import CREW_PROFILES, baseline_blocks, generate_readings
from app.db import SessionLocal
from app.models import (
    Alert,
    Astronaut,
    CrewReading,
    RiskScore,
    ScheduleBlock,
    Scenario,
    SpaceSnapshot,
)


def now_hour() -> datetime:
    return datetime.now(UTC).replace(minute=0, second=0, microsecond=0)


async def reset_dynamic(session: AsyncSession) -> None:
    """Remove all generated rows (keeps data_cache)."""
    for model in (Alert, RiskScore, ScheduleBlock, CrewReading, SpaceSnapshot, Scenario, Astronaut):
        await session.execute(delete(model))


async def seed(session: AsyncSession, reset: bool = False, anchor: datetime | None = None) -> bool:
    """Insert seed rows. Returns True if data was written."""
    if reset:
        await reset_dynamic(session)
    elif (await session.execute(select(Astronaut.id).limit(1))).first():
        return False

    anchor = anchor or now_hour()
    for p in CREW_PROFILES:
        a = Astronaut(callsign=p.callsign, name=p.name, role=p.role,
                      hrv_baseline=p.hrv_baseline, location=p.location)
        session.add(a)
        await session.flush()
        session.add_all(CrewReading(astronaut_id=a.id, **r) for r in generate_readings(p, anchor))
        session.add_all(
            ScheduleBlock(astronaut_id=a.id, version=0, is_replanned=False, **b)
            for b in baseline_blocks(p.callsign, anchor)
        )
    await session.commit()
    return True


async def main() -> None:
    async with SessionLocal() as session:
        wrote = await seed(session, reset="--reset" in sys.argv)
    print("seed: inserted crew, readings, baseline schedule" if wrote else "seed: already seeded, skipped")


if __name__ == "__main__":
    asyncio.run(main())
