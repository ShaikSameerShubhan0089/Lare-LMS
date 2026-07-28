from __future__ import annotations

from pydantic import BaseModel, Field


class CaseIn(BaseModel):
    input: str = ""
    expected: str = ""


class ProblemIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    statement: str = Field(min_length=1, max_length=4096)
    languages: list[str] = ["python"]
    time_limit_sec: int = Field(default=5, ge=1, le=15)
    sample_cases: list[CaseIn] = []
    hidden_cases: list[CaseIn] = []
    max_score: float = Field(default=100.0, gt=0)


class OpenSessionIn(BaseModel):
    problem_id: str
    exam_session_id: str | None = None
    language: str = "python"


class SaveIn(BaseModel):
    code: str = ""


class RunIn(BaseModel):
    code: str = ""
