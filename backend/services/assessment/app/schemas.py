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
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")


class DrillStartIn(BaseModel):
    topic: str | None = None
    target: int = Field(default=8, ge=3, le=20)


class DrillAnswerIn(BaseModel):
    item_id: str
    option: str = ""
    elapsed_ms: int = Field(default=0, ge=0)


class TeachRequestIn(BaseModel):
    topic: str = Field(min_length=1, max_length=128)
    mentor_id: str = Field(min_length=1, max_length=64)
    note: str | None = Field(default=None, max_length=512)


class TeachRespondIn(BaseModel):
    accept: bool = True


class LessonIn(BaseModel):
    topic: str = Field(min_length=1, max_length=128)
    force: bool = False


class WorldOptionIn(BaseModel):
    id: str | None = None
    text: str = Field(min_length=1, max_length=512)
    correct: bool = False
    feedback: str | None = Field(default=None, max_length=512)


class WorldStepIn(BaseModel):
    id: str | None = None
    situation: str = Field(min_length=1, max_length=4096)
    artifact: dict | None = None      # {"type":"logs|code|table","content":"..."}
    prompt: str = Field(min_length=1, max_length=512)
    options: list[WorldOptionIn] = []


class WorldIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    role: str = Field(default="", max_length=80)
    skill: str = Field(default="", max_length=80)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    summary: str | None = Field(default=None, max_length=512)
    steps: list[WorldStepIn] = []
    pass_pct: int = Field(default=60, ge=0, le=100)


class WorldAnswerIn(BaseModel):
    step_id: str
    choice: str


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
    proctored: bool = False
    shuffle: bool = False
    items: list[ItemIn] = []


class StartIn(BaseModel):
    learner_id: str


class SubmitIn(BaseModel):
    # answers: {item_id: response} where response = {"option":"b"} or {"options":[...]} or {"text":"..."}
    answers: dict


class GradeIn(BaseModel):
    score: float = Field(ge=0)


class SkillReq(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    weight: float = Field(default=1.0, gt=0, le=10)


class CareerIn(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=512)
    required_skills: list[SkillReq] = []
