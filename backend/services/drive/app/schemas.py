from __future__ import annotations

from pydantic import BaseModel, Field


class DriveIn(BaseModel):
    company_id: str
    company_name: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    reporting_time: str | None = None
    venue: str | None = None
    contact_email: str | None = None  # company email — notifications reply here


class RoleIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    ctc: str | None = None
    positions: int = Field(default=1, ge=1)
    description: str | None = None


class EligibilityIn(BaseModel):
    min_cgpa: float | None = Field(default=None, ge=0, le=10)
    branches: list[str] = []
    max_backlogs: int | None = None
    min_lms_score: int | None = Field(default=None, ge=0, le=100)


class RoundIn(BaseModel):
    order: int = Field(ge=1)
    type: str = Field(pattern="^(aptitude|technical|verbal|coding|interview)$")
    config: dict = {}
    service_ref: str | None = None


class RegisterIn(BaseModel):
    candidate_id: str
    # candidate attributes used to evaluate eligibility
    cgpa: float | None = None
    branch: str | None = None
    backlogs: int | None = 0
    lms_score: int | None = None


class ShortlistIn(BaseModel):
    candidate_ids: list[str]


class AdvanceIn(BaseModel):
    candidate_id: str


class PpoIn(BaseModel):
    eligibility: dict = {}
    stages: list = []
    conversion_criteria: dict = {}
