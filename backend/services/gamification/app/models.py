"""Gamification models (schema: lms_gamification)."""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from lare_common.db import Base
from lare_common.security import new_id


def _uuid() -> str:
    return new_id()


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class XPEntry(Base):
    __tablename__ = "xp_ledger"
    # Idempotency: one award per (learner, source_event_id).
    __table_args__ = (UniqueConstraint("learner_id", "source_event_id", name="uq_xp_event"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(64))
    points: Mapped[int] = mapped_column(Integer, default=0)
    source_event_id: Mapped[str | None] = mapped_column(String(96))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class LevelState(Base):
    __tablename__ = "levels"

    learner_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    display_name: Mapped[str | None] = mapped_column(String(120))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(String(255))
    icon: Mapped[str | None] = mapped_column(String(64))


class LearnerBadge(Base):
    __tablename__ = "learner_badges"
    __table_args__ = (UniqueConstraint("learner_id", "badge_code", name="uq_learner_badge"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    badge_code: Mapped[str] = mapped_column(String(64))
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Streak(Base):
    __tablename__ = "streaks"

    learner_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    current: Mapped[int] = mapped_column(Integer, default=0)
    longest: Mapped[int] = mapped_column(Integer, default=0)
    last_active_day: Mapped[date | None] = mapped_column(Date)
    freezes: Mapped[int] = mapped_column(Integer, default=0)
