"""Coding assessment models (schema: drive_coding)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from lare_common.db import Base
from lare_common.security import new_id


def _uuid() -> str:
    return new_id()


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255))
    statement: Mapped[str] = mapped_column(String(4096))
    languages: Mapped[list] = mapped_column(JSON, default=lambda: ["python"])
    time_limit_sec: Mapped[int] = mapped_column(Integer, default=5)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, default=256)
    # [{"input":"..","expected":".."}] — samples are visible, hidden are not
    sample_cases: Mapped[list] = mapped_column(JSON, default=list)
    hidden_cases: Mapped[list] = mapped_column(JSON, default=list)
    max_score: Mapped[float] = mapped_column(Float, default=100.0)


class CodingSession(Base):
    __tablename__ = "coding_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    problem_id: Mapped[str] = mapped_column(String(64), index=True)
    candidate_id: Mapped[str] = mapped_column(String(64), index=True)
    exam_session_id: Mapped[str | None] = mapped_column(String(64))
    language: Mapped[str] = mapped_column(String(16), default="python")
    draft_code: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String(16), default="open")  # open|submitted
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class CodingSubmission(Base):
    __tablename__ = "coding_submissions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    coding_session_id: Mapped[str] = mapped_column(String(64), index=True)
    code: Mapped[str] = mapped_column(String, default="")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    cases_passed: Mapped[int] = mapped_column(Integer, default=0)
    total_cases: Mapped[int] = mapped_column(Integer, default=0)
    detail: Mapped[list] = mapped_column(JSON, default=list)  # per-hidden-case pass/fail (no expected)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
