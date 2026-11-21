"""SQLAlchemy ORM models. Portable across PostgreSQL (prod) and SQLite (local dev)."""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

# JSONB on Postgres, plain JSON elsewhere.
JSONType = JSON().with_variant(JSONB(), "postgresql")


class Astronaut(Base):
    __tablename__ = "astronauts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    callsign: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(80))
    hrv_baseline: Mapped[float] = mapped_column(Float)
    location: Mapped[str] = mapped_column(String(32), default="cabin")


class CrewReading(Base):
    __tablename__ = "crew_readings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id", ondelete="CASCADE"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    sleep_hours: Mapped[float] = mapped_column(Float)
    sleep_debt_h: Mapped[float] = mapped_column(Float)
    hrv_ms: Mapped[float] = mapped_column(Float)
    fatigue_sp: Mapped[int] = mapped_column(Integer)
    heart_rate: Mapped[float] = mapped_column(Float)


class SpaceSnapshot(Base):
    __tablename__ = "space_snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    alt_km: Mapped[float] = mapped_column(Float)
    sunlit: Mapped[bool] = mapped_column(Boolean)
    in_saa: Mapped[bool] = mapped_column(Boolean)
    saa_intensity: Mapped[float] = mapped_column(Float)
    flare_class: Mapped[str] = mapped_column(String(8))
    flare_flux: Mapped[float] = mapped_column(Float)


class RiskScore(Base):
    __tablename__ = "risk_scores"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id", ondelete="CASCADE"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    radiation: Mapped[float] = mapped_column(Float)
    sleep_deficit: Mapped[float] = mapped_column(Float)
    risk: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(8))


class ScheduleBlock(Base):
    __tablename__ = "schedule_blocks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id", ondelete="CASCADE"), index=True)
    start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    activity: Mapped[str] = mapped_column(String(24))
    version: Mapped[int] = mapped_column(Integer, default=0, index=True)
    is_replanned: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    severity: Mapped[str] = mapped_column(String(8))
    astronaut_id: Mapped[int | None] = mapped_column(
        ForeignKey("astronauts.id", ondelete="SET NULL"), nullable=True
    )
    action_type: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(Text)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)


class DataCache(Base):
    __tablename__ = "data_cache"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSONType)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    state: Mapped[dict] = mapped_column(JSONType)
