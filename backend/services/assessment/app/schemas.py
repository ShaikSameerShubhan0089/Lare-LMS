from __future__ import annotations

from pydantic import BaseModel, Field


class ItemIn(BaseModel):
    item_type: str = Field(pattern="^(mcq|multi|subjective)$")
    prompt: str = Field(min_length=1, max_length=1024)
    options: list[dict] = []          # [{"id":"a","text":"..."}]
    correct: dict = {}                # {"option":"b"} | {"options":["a","c"]}
    weight: float = Field(default=1.0, gt=0)
    rubric_hint: str | None = None
    order: int = 0


class AssessmentIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    year_no: int = Field(default=1, ge=1, le=4)
    type: str = Field(default="quiz", max_length=32)
    time_limit_min: int = 0
    attempts_allowed: int = Field(default=1, ge=1)
    passing_pct: int = Field(default=60, ge=0, le=100)
    negative_marking: float = Field(default=0.0, ge=0)
    dimension: str = Field(default="aptitude", pattern="^(communication|coding|aptitude|project)$")
    objectives: list[str] = []
    items: list[ItemIn] = []


class StartIn(BaseModel):
    learner_id: str


class SubmitIn(BaseModel):
    # answers: {item_id: response} where response = {"option":"b"} or {"options":[...]} or {"text":"..."}
    answers: dict


class GradeIn(BaseModel):
    score: float = Field(ge=0)
