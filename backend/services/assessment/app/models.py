"""Assessment domain models (schema: lms_assessment)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, JSON, String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lare_common.db import Base
from lare_common.security import new_id


def _uuid() -> str:
    return new_id()


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255))
    year_no: Mapped[int] = mapped_column(Integer, default=1)
    type: Mapped[str] = mapped_column(String(32), default="quiz")  # quiz|aptitude|coding|rubric
    time_limit_min: Mapped[int] = mapped_column(Integer, default=0)
    attempts_allowed: Mapped[int] = mapped_column(Integer, default=1)
    passing_pct: Mapped[int] = mapped_column(Integer, default=60)
    negative_marking: Mapped[float] = mapped_column(Float, default=0.0)
    dimension: Mapped[str] = mapped_column(String(16), default="aptitude")  # scorecard dim
    objectives: Mapped[list] = mapped_column(JSON, default=list)
    # Anti-cheat: proctored quizzes enforce tab-switch/copy-paste/fullscreen rules
    # (5-flag auto-submit); shuffle randomises question + option order per student.
    proctored: Mapped[bool] = mapped_column(Boolean, default=False)
    shuffle: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    items: Mapped[list["Item"]] = relationship(cascade="all, delete-orphan")


class Item(Base):
    __tablename__ = "assessment_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    assessment_id: Mapped[str] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    item_type: Mapped[str] = mapped_column(String(16))  # mcq | multi | subjective
    prompt: Mapped[str] = mapped_column(String(1024))
    options: Mapped[list] = mapped_column(JSON, default=list)  # [{id,text}]
    correct: Mapped[dict] = mapped_column(JSON, default=dict)  # {"option": "b"} | {"options":[...]}
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    rubric_hint: Mapped[str | None] = mapped_column(String(1024))
    order: Mapped[int] = mapped_column(Integer, default=0)


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    assessment_id: Mapped[str] = mapped_column(String(64), index=True)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="in_progress")  # in_progress|submitted|graded
    score: Mapped[float] = mapped_column(Float, default=0.0)
    max_score: Mapped[float] = mapped_column(Float, default=0.0)
    percentage: Mapped[float] = mapped_column(Float, default=0.0)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    attempt_id: Mapped[str] = mapped_column(ForeignKey("attempts.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON, default=dict)
    auto_score: Mapped[float | None] = mapped_column(Float)
    final_score: Mapped[float | None] = mapped_column(Float)
    needs_grade: Mapped[bool] = mapped_column(Boolean, default=False)
    grader_user_id: Mapped[str | None] = mapped_column(String(64))
    max_score: Mapped[float] = mapped_column(Float, default=1.0)
