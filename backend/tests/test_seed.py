from datetime import UTC, datetime

from sqlalchemy import func, select

from app.data.crew_simulator import CREW_PROFILES, generate_readings, target_reading
from app.models import Astronaut, CrewReading, ScheduleBlock
from app.seed import seed

ANCHOR = datetime(2026, 11, 22, 6, 0, tzinfo=UTC)


async def test_seed_inserts_three_astronauts_and_is_idempotent(session):
    assert await seed(session, anchor=ANCHOR) is True
    assert await seed(session, anchor=ANCHOR) is False
    names = (await session.execute(select(Astronaut.callsign).order_by(Astronaut.id))).scalars().all()
    assert names == ["Vyomnaut 01", "Vyomnaut 02", "Vyomnaut 03"]
    n_readings = (await session.execute(select(func.count(CrewReading.id)))).scalar_one()
    assert n_readings == 3 * 73
    evas = (await session.execute(select(ScheduleBlock).where(ScheduleBlock.activity == "eva"))).scalars().all()
    assert len(evas) == 1


async def test_seed_reset_rebuilds(session):
    await seed(session, anchor=ANCHOR)
    assert await seed(session, reset=True, anchor=ANCHOR) is True
    assert (await session.execute(select(func.count(Astronaut.id)))).scalar_one() == 3


def test_vyomnaut_02_is_sleep_deprived():
    v2 = next(p for p in CREW_PROFILES if p.callsign == "Vyomnaut 02")
    t = target_reading(v2)
    assert abs(t["sleep_debt_h"] - 5.0) < 0.05
    assert t["hrv_ms"] == round(v2.hrv_baseline * 0.75, 1)
    assert t["fatigue_sp"] == 5


def test_readings_are_deterministic_and_end_on_target():
    p = CREW_PROFILES[1]
    a, b = generate_readings(p, ANCHOR), generate_readings(p, ANCHOR)
    assert a == b
    assert len(a) == 73
    assert a[-1]["ts"] == ANCHOR
    assert {k: v for k, v in a[-1].items() if k != "ts"} == target_reading(p)
