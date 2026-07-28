from __future__ import annotations

from pydantic import BaseModel, Field


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: str | None = None
    context: str = ""


class PlanIn(BaseModel):
    variables: dict = Field(default_factory=dict)
