from __future__ import annotations

from pydantic import BaseModel, Field


class CurriculumIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)


class YearTrackIn(BaseModel):
    year_no: int = Field(ge=1, le=4)
    theme: str | None = None
    goal: str | None = None


class ModuleIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    order: int = 0
    branch_scope: str = Field(default="all", max_length=32)


class LessonIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    order: int = 0
    content_ref: str | None = None
    content: list[dict] = []


class LessonContentIn(BaseModel):
    content: list[dict] = []


class ObjectiveIn(BaseModel):
    statement: str = Field(min_length=1, max_length=512)
    skill_tag: str | None = None


class OutcomeCheckIn(BaseModel):
    statement: str = Field(min_length=1, max_length=512)
    criteria: str | None = None


class MapCohortIn(BaseModel):
    cohort_id: str
    effective_from: str | None = None


class MapItemIn(BaseModel):
    item_type: str = Field(pattern="^(content|assessment)$")
    item_id: str
