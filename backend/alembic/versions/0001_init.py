"""init schema

Revision ID: 0001_init
Revises:
Create Date: 2026-11-22
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None

JSONType = sa.JSON().with_variant(JSONB(), "postgresql")
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "astronauts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("callsign", sa.String(32), nullable=False, unique=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("role", sa.String(80), nullable=False),
        sa.Column("hrv_baseline", sa.Float, nullable=False),
        sa.Column("location", sa.String(32), nullable=False),
    )
    op.create_table(
        "crew_readings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("astronaut_id", sa.Integer, sa.ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ts", TS, nullable=False),
        sa.Column("sleep_hours", sa.Float, nullable=False),
        sa.Column("sleep_debt_h", sa.Float, nullable=False),
        sa.Column("hrv_ms", sa.Float, nullable=False),
        sa.Column("fatigue_sp", sa.Integer, nullable=False),
        sa.Column("heart_rate", sa.Float, nullable=False),
    )
    op.create_index("ix_crew_readings_astronaut_id", "crew_readings", ["astronaut_id"])
    op.create_index("ix_crew_readings_ts", "crew_readings", ["ts"])
    op.create_table(
        "space_snapshots",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("ts", TS, nullable=False),
        sa.Column("lat", sa.Float, nullable=False),
        sa.Column("lon", sa.Float, nullable=False),
        sa.Column("alt_km", sa.Float, nullable=False),
        sa.Column("sunlit", sa.Boolean, nullable=False),
        sa.Column("in_saa", sa.Boolean, nullable=False),
        sa.Column("saa_intensity", sa.Float, nullable=False),
        sa.Column("flare_class", sa.String(8), nullable=False),
        sa.Column("flare_flux", sa.Float, nullable=False),
    )
    op.create_index("ix_space_snapshots_ts", "space_snapshots", ["ts"])
    op.create_table(
        "risk_scores",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("astronaut_id", sa.Integer, sa.ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ts", TS, nullable=False),
        sa.Column("radiation", sa.Float, nullable=False),
        sa.Column("sleep_deficit", sa.Float, nullable=False),
        sa.Column("risk", sa.Integer, nullable=False),
        sa.Column("status", sa.String(8), nullable=False),
    )
    op.create_index("ix_risk_scores_astronaut_id", "risk_scores", ["astronaut_id"])
    op.create_index("ix_risk_scores_ts", "risk_scores", ["ts"])
    op.create_table(
        "schedule_blocks",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("astronaut_id", sa.Integer, sa.ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start", TS, nullable=False),
        sa.Column("end", TS, nullable=False),
        sa.Column("activity", sa.String(24), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("is_replanned", sa.Boolean, nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
    )
    op.create_index("ix_schedule_blocks_astronaut_id", "schedule_blocks", ["astronaut_id"])
    op.create_index("ix_schedule_blocks_version", "schedule_blocks", ["version"])
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("ts", TS, nullable=False),
        sa.Column("severity", sa.String(8), nullable=False),
        sa.Column("astronaut_id", sa.Integer, sa.ForeignKey("astronauts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action_type", sa.String(32), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("acknowledged", sa.Boolean, nullable=False),
    )
    op.create_index("ix_alerts_ts", "alerts", ["ts"])
    op.create_table(
        "data_cache",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("payload", JSONType, nullable=False),
        sa.Column("fetched_at", TS, nullable=False),
    )
    op.create_table(
        "scenarios",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("started_at", TS, nullable=False),
        sa.Column("state", JSONType, nullable=False),
    )


def downgrade() -> None:
    for t in ("scenarios", "data_cache", "alerts", "schedule_blocks", "risk_scores",
              "space_snapshots", "crew_readings", "astronauts"):
        op.drop_table(t)
