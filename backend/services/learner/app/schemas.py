from __future__ import annotations

from pydantic import BaseModel, Field

STREAMS = "^(ai_ml|data_science|web|cybersecurity|cloud)$"


class LearnerIn(BaseModel):
    user_id: str | None = None
    college_id: str
    cohort_id: str | None = None
    branch_id: str | None = None
    roll_no: str = Field(min_length=1, max_length=64)
    full_name: str | None = None
    email: str | None = None
    cgpa: float | None = Field(default=None, ge=0, le=10)
    year_no: int = Field(default=1, ge=1, le=4)


class ImportRow(BaseModel):
    roll_no: str
    full_name: str | None = None
    email: str | None = None
    branch_id: str | None = None
    cgpa: float | None = None


class ImportIn(BaseModel):
    college_id: str
    rows: list[ImportRow]
    commit: bool = False


class StreamIn(BaseModel):
    stream: str = Field(pattern=STREAMS)
    rationale: str | None = None
    mentor_user_id: str | None = None


class ProjectIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    repo_url: str | None = None


class PromoteIn(BaseModel):
    year_no: int = Field(ge=1, le=4)
    academic_year_id: str | None = None
