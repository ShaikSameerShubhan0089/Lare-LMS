from __future__ import annotations

from pydantic import BaseModel, Field


class ScheduleIn(BaseModel):
    drive_id: str
    candidate_id: str
    round_id: str | None = None
    stage: str = Field(default="technical", pattern="^(technical|hr|ppo)$")
    mode: str = Field(default="online", pattern="^(online|in_person)$")
    link: str | None = None
    slot: str | None = None


class AllocateIn(BaseModel):
    interviewer_id: str


class RateIn(BaseModel):
    competency: str = Field(pattern="^(technical|communication|problem_solving|culture)$")
    score: float = Field(ge=1, le=5)
    remark: str | None = None


class DecisionIn(BaseModel):
    decision: str = Field(pattern="^(select|reject|hold|next_round)$")
    reason: str | None = None
