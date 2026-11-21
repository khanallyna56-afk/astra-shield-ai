"""Shared fixtures.

* ``session``: isolated in-memory SQLite database per test (engine/unit tests).
* ``client``: FastAPI TestClient bound to a temporary seeded SQLite file (API tests).
"""
import os
import tempfile

_DB_FILE = os.path.join(tempfile.mkdtemp(prefix="astra-test-"), "test.db")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB_FILE}"
os.environ["DATA_MODE"] = "offline"
os.environ["TICKER_ENABLED"] = "false"

import asyncio  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

import app.models  # noqa: E402,F401  (register tables)
from app.db import Base  # noqa: E402


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()


async def _reset_db():
    from app import services as svc
    from app.db import SessionLocal, engine
    from app.seed import seed

    svc.SCENARIO = None
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as s:
        await seed(s)
    await engine.dispose()


@pytest.fixture
def client():
    """Fresh seeded database + TestClient (lifespan runs, so history is backfilled)."""
    from fastapi.testclient import TestClient

    from app.main import app

    asyncio.run(_reset_db())
    with TestClient(app) as c:
        yield c
