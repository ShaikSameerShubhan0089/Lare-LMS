from __future__ import annotations

from pydantic import BaseModel, Field


class AwardIn(BaseModel):
    learner_id: str
    action: str = Field(min_length=1, max_length=64)
    points: int = Field(ge=0, le=10000)
    source_event_id: str | None = None
    display_name: str | None = None


class ActivityIn(BaseModel):
    learner_id: str
    day: str | None = None  # ISO date; defaults to today (UTC)


class BadgeIn(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str
    description: str | None = None
    icon: str | None = None


class GrantBadgeIn(BaseModel):
    learner_id: str
    badge_code: str
