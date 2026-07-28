from __future__ import annotations

from pydantic import BaseModel, Field


class TemplateIn(BaseModel):
    year_no: int = Field(ge=1, le=4)
    name: str = Field(min_length=1, max_length=255)
    signatories: str | None = None


class IssueIn(BaseModel):
    learner_id: str
    year_no: int = Field(ge=1, le=4)
    holder_name: str | None = None
    ppo_tag: bool = False  # only meaningful for year 4


class RevokeIn(BaseModel):
    reason: str = Field(min_length=1, max_length=512)
