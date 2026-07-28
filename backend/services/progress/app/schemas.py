from __future__ import annotations

from pydantic import BaseModel, Field


class AttendanceIn(BaseModel):
    learner_id: str
    schedule_slot_id: str
    status: str = Field(pattern="^(present|absent|late)$")


class ModuleProgressIn(BaseModel):
    learner_id: str
    module_id: str
    completion_pct: float = Field(ge=0, le=100)


class ScoreIn(BaseModel):
    learner_id: str
    year_no: int = Field(ge=1, le=4)
    dimension: str = Field(pattern="^(communication|coding|aptitude|project)$")
    value: float = Field(ge=0, le=100)
    source: str | None = None
    ref_id: str | None = None


class ComputeYearIn(BaseModel):
    learner_id: str
    year_no: int = Field(ge=1, le=4)
