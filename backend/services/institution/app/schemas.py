from __future__ import annotations

from pydantic import BaseModel, Field


class CollegeIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    address: str | None = None
    timezone: str = "Asia/Kolkata"
    mou_ref: str | None = None
    coordinator_user_id: str | None = None
    passing_threshold: int = Field(default=60, ge=0, le=100)
    min_cohort_size: int = Field(default=30, ge=1)


class BranchIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    code: str = Field(min_length=1, max_length=32)
    category: str = Field(default="cse_allied", pattern="^(cse_allied|core)$")


class SemesterIn(BaseModel):
    type: str = Field(pattern="^(odd|even)$")
    start: str | None = None
    end: str | None = None


class AcademicYearIn(BaseModel):
    year_no: int = Field(ge=1, le=4)
    start: str | None = None
    end: str | None = None
    semesters: list[SemesterIn] = []


class CohortIn(BaseModel):
    branch_id: str
    academic_year_id: str | None = None
    section: str | None = None
    year_no: int = Field(default=1, ge=1, le=4)
    size: int = Field(default=0, ge=0)


class ScheduleSlotIn(BaseModel):
    semester_id: str
    branch_id: str
    week_no: int = Field(ge=1)
    module_ref: str | None = None
    start: str | None = None
    end: str | None = None
    trainer_user_id: str | None = None


class AssignmentIn(BaseModel):
    user_id: str
    role: str = Field(pattern="^(trainer|mentor|coordinator)$")
    scope: str | None = None


class ConfigIn(BaseModel):
    passing_threshold: int = Field(ge=0, le=100)
    min_cohort_size: int = Field(ge=1)
