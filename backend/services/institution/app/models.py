"""Institution domain models (schema: lms_institution)."""
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


class College(Base):
    __tablename__ = "colleges"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(String(64), default="lare", index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(512))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    mou_ref: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), default="active")
    coordinator_user_id: Mapped[str | None] = mapped_column(String(64))
    passing_threshold: Mapped[int] = mapped_column(Integer, default=60)
    min_cohort_size: Mapped[int] = mapped_column(Integer, default=30)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    branches: Mapped[list["Branch"]] = relationship(
        back_populates="college", cascade="all, delete-orphan"
    )


class Branch(Base):
    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("college_id", "code", name="uq_branch_code"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    college_id: Mapped[str] = mapped_column(ForeignKey("colleges.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    # category drives odd/even scheduling: cse_allied (odd) vs core (even)
    category: Mapped[str] = mapped_column(String(16), default="cse_allied")

    college: Mapped[College] = relationship(back_populates="branches")


class AcademicYear(Base):
    __tablename__ = "academic_years"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    college_id: Mapped[str] = mapped_column(ForeignKey("colleges.id", ondelete="CASCADE"), index=True)
    year_no: Mapped[int] = mapped_column(Integer)  # 1..4
    start: Mapped[date | None] = mapped_column(Date)
    end: Mapped[date | None] = mapped_column(Date)

    semesters: Mapped[list["Semester"]] = relationship(
        back_populates="academic_year", cascade="all, delete-orphan"
    )


class Semester(Base):
    __tablename__ = "semesters"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    academic_year_id: Mapped[str] = mapped_column(
        ForeignKey("academic_years.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(8))  # odd | even
    start: Mapped[date | None] = mapped_column(Date)
    end: Mapped[date | None] = mapped_column(Date)

    academic_year: Mapped[AcademicYear] = relationship(back_populates="semesters")


class Cohort(Base):
    __tablename__ = "cohorts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    college_id: Mapped[str] = mapped_column(ForeignKey("colleges.id", ondelete="CASCADE"), index=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"))
    academic_year_id: Mapped[str | None] = mapped_column(String)
    section: Mapped[str | None] = mapped_column(String(16))
    year_no: Mapped[int] = mapped_column(Integer, default=1)
    size: Mapped[int] = mapped_column(Integer, default=0)


class ScheduleSlot(Base):
    __tablename__ = "schedule_slots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    semester_id: Mapped[str] = mapped_column(ForeignKey("semesters.id", ondelete="CASCADE"), index=True)
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"))
    week_no: Mapped[int] = mapped_column(Integer)
    module_ref: Mapped[str | None] = mapped_column(String(128))
    start: Mapped[date | None] = mapped_column(Date)
    end: Mapped[date | None] = mapped_column(Date)
    trainer_user_id: Mapped[str | None] = mapped_column(String(64))


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    college_id: Mapped[str] = mapped_column(ForeignKey("colleges.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(32))  # trainer | mentor | coordinator
    scope: Mapped[str | None] = mapped_column(String(64))
