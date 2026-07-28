"""Progress tracking models (schema: lms_progress)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Float, Integer, String, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from lare_common.db import Base
from lare_common.security import new_id


def _uuid() -> str:
    return new_id()


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    schedule_slot_id: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(8))  # present | absent | late
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ModuleProgress(Base):
    __tablename__ = "module_progress"
    __table_args__ = (UniqueConstraint("learner_id", "module_id", name="uq_module_progress"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    module_id: Mapped[str] = mapped_column(String(64))
    completion_pct: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class Scorecard(Base):
    """One row per learner per year — the skill scorecard (4 dimensions)."""
    __tablename__ = "scorecard"
    __table_args__ = (UniqueConstraint("learner_id", "year_no", name="uq_scorecard"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    year_no: Mapped[int] = mapped_column(Integer, default=1)
    communication: Mapped[float] = mapped_column(Float, default=0.0)
    coding: Mapped[float] = mapped_column(Float, default=0.0)
    aptitude: Mapped[float] = mapped_column(Float, default=0.0)
    project: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class ScoreEvent(Base):
    __tablename__ = "score_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    year_no: Mapped[int] = mapped_column(Integer, default=1)
    dimension: Mapped[str] = mapped_column(String(16))  # communication|coding|aptitude|project
    value: Mapped[float] = mapped_column(Float)
    source: Mapped[str | None] = mapped_column(String(64))
    ref_id: Mapped[str | None] = mapped_column(String(64))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class YearStatus(Base):
    __tablename__ = "year_status"
    __table_args__ = (UniqueConstraint("learner_id", "year_no", name="uq_year_status"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    year_no: Mapped[int] = mapped_column(Integer)
    criteria_met: Mapped[bool] = mapped_column(Boolean, default=False)
    attendance_pct: Mapped[float] = mapped_column(Float, default=0.0)
    avg_score: Mapped[float] = mapped_column(Float, default=0.0)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
