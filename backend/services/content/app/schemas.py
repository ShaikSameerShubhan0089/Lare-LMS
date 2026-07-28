from __future__ import annotations

from pydantic import BaseModel, Field


class ContentIn(BaseModel):
    lesson_id: str
    title: str = Field(min_length=1, max_length=255)
    type: str = Field(pattern="^(video|pdf|slide|reading|interactive|link)$")
    file_id: str | None = None
    url: str | None = None
    duration_sec: int = Field(default=0, ge=0)
    difficulty: str = Field(default="easy", pattern="^(easy|medium|hard)$")
    order: int = 0
    objectives: list[str] = []


class GateIn(BaseModel):
    prereq_content_item_id: str


class ProgressIn(BaseModel):
    learner_id: str
    position_sec: int = Field(default=0, ge=0)
    completed: bool = False
