"""Learner domain models (schema: lms_learner)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lare_common.db import Base
from lare_common.security import new_id


def _uuid() -> str:
    return new_id()


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class Learner(Base):
    __tablename__ = "learners"
    __table_args__ = (UniqueConstraint("college_id", "roll_no", name="uq_learner_roll"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(String(64), index=True)
    college_id: Mapped[str] = mapped_column(String(64), index=True)
    cohort_id: Mapped[str | None] = mapped_column(String(64))
    branch_id: Mapped[str | None] = mapped_column(String(64))
    roll_no: Mapped[str] = mapped_column(String(64))
    full_name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    cgpa: Mapped[float | None] = mapped_column(Float)
    photo_file_id: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="active")  # active|paused|alumni
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    year_no: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    skills: Mapped[list["Skill"]] = relationship(cascade="all, delete-orphan")
    projects: Mapped[list["Project"]] = relationship(cascade="all, delete-orphan")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(ForeignKey("learners.id", ondelete="CASCADE"), index=True)
    academic_year_id: Mapped[str | None] = mapped_column(String(64))
    year_no: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class StreamSelection(Base):
    __tablename__ = "stream_selection"

    learner_id: Mapped[str] = mapped_column(
        ForeignKey("learners.id", ondelete="CASCADE"), primary_key=True
    )
    stream: Mapped[str] = mapped_column(String(32))  # ai_ml|data_science|web|cybersecurity|cloud
    rationale: Mapped[str | None] = mapped_column(String(512))
    mentor_user_id: Mapped[str | None] = mapped_column(String(64))
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(ForeignKey("learners.id", ondelete="CASCADE"), index=True)
    skill: Mapped[str] = mapped_column(String(64))
    level: Mapped[str | None] = mapped_column(String(32))
    source: Mapped[str | None] = mapped_column(String(64))


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(ForeignKey("learners.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(1024))
    repo_url: Mapped[str | None] = mapped_column(String(512))


class ImportJob(Base):
    __tablename__ = "imports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    college_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="previewed")  # previewed|committed
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
