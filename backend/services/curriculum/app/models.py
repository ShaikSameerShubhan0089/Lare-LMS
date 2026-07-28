"""Curriculum domain models (schema: lms_curriculum)."""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lare_common.db import Base
from lare_common.security import new_id


def _uuid() -> str:
    return new_id()


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class Curriculum(Base):
    __tablename__ = "curricula"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | published
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    years: Mapped[list["YearTrack"]] = relationship(
        back_populates="curriculum", cascade="all, delete-orphan"
    )


class YearTrack(Base):
    __tablename__ = "year_tracks"
    __table_args__ = (UniqueConstraint("curriculum_id", "year_no", name="uq_year"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    curriculum_id: Mapped[str] = mapped_column(ForeignKey("curricula.id", ondelete="CASCADE"), index=True)
    year_no: Mapped[int] = mapped_column(Integer)  # 1..4
    theme: Mapped[str | None] = mapped_column(String(255))
    goal: Mapped[str | None] = mapped_column(String(512))

    curriculum: Mapped[Curriculum] = relationship(back_populates="years")
    modules: Mapped[list["Module"]] = relationship(cascade="all, delete-orphan")
    outcome_checks: Mapped[list["OutcomeCheck"]] = relationship(cascade="all, delete-orphan")


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    year_track_id: Mapped[str] = mapped_column(ForeignKey("year_tracks.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    order: Mapped[int] = mapped_column(Integer, default=0)
    # all | cse_allied | core | <branch_code>
    branch_scope: Mapped[str] = mapped_column(String(32), default="all")

    lessons: Mapped[list["Lesson"]] = relationship(cascade="all, delete-orphan")


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    module_id: Mapped[str] = mapped_column(ForeignKey("modules.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    order: Mapped[int] = mapped_column(Integer, default=0)
    content_ref: Mapped[str | None] = mapped_column(String(128))

    objectives: Mapped[list["Objective"]] = relationship(cascade="all, delete-orphan")


class Objective(Base):
    __tablename__ = "objectives"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    statement: Mapped[str] = mapped_column(String(512))
    skill_tag: Mapped[str | None] = mapped_column(String(64))


class OutcomeCheck(Base):
    __tablename__ = "outcome_checks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    year_track_id: Mapped[str] = mapped_column(ForeignKey("year_tracks.id", ondelete="CASCADE"), index=True)
    statement: Mapped[str] = mapped_column(String(512))
    criteria: Mapped[str | None] = mapped_column(String(512))


class CohortCurriculum(Base):
    __tablename__ = "cohort_curriculum"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    cohort_id: Mapped[str] = mapped_column(String(64), index=True)
    curriculum_id: Mapped[str] = mapped_column(ForeignKey("curricula.id", ondelete="CASCADE"))
    effective_from: Mapped[date | None] = mapped_column(Date)


class ItemObjectiveMap(Base):
    __tablename__ = "item_objective_map"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    objective_id: Mapped[str] = mapped_column(ForeignKey("objectives.id", ondelete="CASCADE"), index=True)
    item_type: Mapped[str] = mapped_column(String(16))  # content | assessment
    item_id: Mapped[str] = mapped_column(String(64))
