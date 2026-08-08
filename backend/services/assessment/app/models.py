"""Assessment domain models (schema: lms_assessment)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lare_common.db import Base
from lare_common.security import new_id


def _uuid() -> str:
    return new_id()


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255))
    year_no: Mapped[int] = mapped_column(Integer, default=1)
    type: Mapped[str] = mapped_column(String(32), default="quiz")  # quiz|aptitude|coding|rubric
    time_limit_min: Mapped[int] = mapped_column(Integer, default=0)
    attempts_allowed: Mapped[int] = mapped_column(Integer, default=1)
    passing_pct: Mapped[int] = mapped_column(Integer, default=60)
    negative_marking: Mapped[float] = mapped_column(Float, default=0.0)
    dimension: Mapped[str] = mapped_column(String(16), default="aptitude")  # scorecard dim
    objectives: Mapped[list] = mapped_column(JSON, default=list)
    # Anti-cheat: proctored quizzes enforce tab-switch/copy-paste/fullscreen rules
    # (5-flag auto-submit); shuffle randomises question + option order per student.
    proctored: Mapped[bool] = mapped_column(Boolean, default=False)
    shuffle: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    items: Mapped[list["Item"]] = relationship(cascade="all, delete-orphan")


class Item(Base):
    __tablename__ = "assessment_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    assessment_id: Mapped[str] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    item_type: Mapped[str] = mapped_column(String(16))  # mcq | multi | subjective
    prompt: Mapped[str] = mapped_column(String(1024))
    options: Mapped[list] = mapped_column(JSON, default=list)  # [{id,text}]
    correct: Mapped[dict] = mapped_column(JSON, default=dict)  # {"option": "b"} | {"options":[...]}
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    rubric_hint: Mapped[str | None] = mapped_column(String(1024))
    order: Mapped[int] = mapped_column(Integer, default=0)
    # Difficulty drives the adaptive Flow drill (keeps the learner in flow).
    difficulty: Mapped[str] = mapped_column(String(8), default="medium")  # easy|medium|hard


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    assessment_id: Mapped[str] = mapped_column(String(64), index=True)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="in_progress")  # in_progress|submitted|graded
    score: Mapped[float] = mapped_column(Float, default=0.0)
    max_score: Mapped[float] = mapped_column(Float, default=0.0)
    percentage: Mapped[float] = mapped_column(Float, default=0.0)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    attempt_id: Mapped[str] = mapped_column(ForeignKey("attempts.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON, default=dict)
    auto_score: Mapped[float | None] = mapped_column(Float)
    final_score: Mapped[float | None] = mapped_column(Float)
    needs_grade: Mapped[bool] = mapped_column(Boolean, default=False)
    grader_user_id: Mapped[str | None] = mapped_column(String(64))
    max_score: Mapped[float] = mapped_column(Float, default=1.0)


class ReviewItem(Base):
    """Lifelong Reinforcement (Sustain): one spaced-review schedule per learner
    per skill. Knowledge is a maintained state — each item carries a forgetting
    curve (interval + ease, SM-2 style) so shaky concepts resurface before they
    decay. Auto-registered when a learner practises a skill; rescheduled on each
    self-check review."""
    __tablename__ = "review_items"
    __table_args__ = (UniqueConstraint("learner_id", "skill", name="uq_review_learner_skill"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    skill: Mapped[str] = mapped_column(String(128))
    source: Mapped[str] = mapped_column(String(16), default="written")  # written|coding
    interval_days: Mapped[float] = mapped_column(Float, default=1.0)
    ease: Mapped[float] = mapped_column(Float, default=2.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    last_mastery: Mapped[float] = mapped_column(Float, default=0.0)
    last_reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class DrillSession(Base):
    """Flow-layer adaptive drill: serves one MCQ at a time and tunes difficulty
    from live accuracy + response speed to hold the learner near their 'flow'
    zone (~75-80% success). Server-authoritative so grading can't be gamed."""
    __tablename__ = "drill_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    topic: Mapped[str | None] = mapped_column(String(128))
    level: Mapped[int] = mapped_column(Integer, default=1)  # 0 easy | 1 medium | 2 hard
    served: Mapped[list] = mapped_column(JSON, default=list)  # question prompts shown
    pending_item_id: Mapped[str | None] = mapped_column(String(64))  # legacy (pool item)
    # The current AI-generated (or pooled) question awaiting an answer, incl. its
    # key — server-authoritative so grading can't be gamed.
    pending_q: Mapped[dict] = mapped_column(JSON, default=dict)
    pending_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    total_count: Mapped[int] = mapped_column(Integer, default=0)
    fast_count: Mapped[int] = mapped_column(Integer, default=0)
    target: Mapped[int] = mapped_column(Integer, default=8)
    status: Mapped[str] = mapped_column(String(12), default="active")  # active|done
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PracticeWorld(Base):
    """Embodied Practice World: a browser workplace simulation. The learner works
    a realistic scenario (an on-call incident, a data investigation, a PR review)
    step by step; competence is scored from the decisions they make and fed back
    into the twin — practice that resembles the real job, not a quiz."""
    __tablename__ = "practice_worlds"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(80), default="")   # e.g. Backend On-Call
    skill: Mapped[str] = mapped_column(String(80), default="")  # twin skill it maps to
    difficulty: Mapped[str] = mapped_column(String(8), default="medium")
    summary: Mapped[str | None] = mapped_column(String(512))
    # steps: [{id, situation, artifact:{type,content}?, prompt,
    #          options:[{id,text,correct,feedback}]}]
    steps: Mapped[list] = mapped_column(JSON, default=list)
    pass_pct: Mapped[int] = mapped_column(Integer, default=60)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class WorldRun(Base):
    """One learner's run through a Practice World."""
    __tablename__ = "world_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    world_id: Mapped[str] = mapped_column(String(64), index=True)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    step_index: Mapped[int] = mapped_column(Integer, default=0)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)  # {step_id: {choice, correct}}
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(12), default="in_progress")  # in_progress|completed
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class GeneratedLesson(Base):
    """Generative Learning Fabric: an AI-generated micro-lesson for one concept,
    tuned to the learner. Courses dissolve into moments — the exact explanation
    you need, generated now. Stored so it can be revisited (one per learner+topic)."""
    __tablename__ = "generated_lessons"
    __table_args__ = (UniqueConstraint("learner_id", "topic", name="uq_lesson_learner_topic"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    topic: Mapped[str] = mapped_column(String(128))
    lesson: Mapped[dict] = mapped_column(JSON, default=dict)
    generated: Mapped[bool] = mapped_column(Boolean, default=False)  # AI vs fallback
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class TeachSession(Base):
    """Human Knowledge Mesh: a peer teach-back pairing on one topic — a learner
    who is strong on it teaches one who is a step behind (the strongest known
    learning effect). The seeker requests; the mentor accepts."""
    __tablename__ = "teach_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    topic: Mapped[str] = mapped_column(String(128))
    teacher_id: Mapped[str] = mapped_column(String(64), index=True)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)  # the seeker
    requested_by: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(12), default="requested")  # requested|accepted|declined|completed
    note: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class WalletCredential(Base):
    """Sovereign Learning Wallet: a signed, verifiable snapshot of a learner's
    proven competence that the learner owns and can share. Anyone can confirm it
    at the public /verify/wallet/<verify_id> endpoint — trust without a walled
    garden. One active credential per learner (re-issue refreshes it in place, so
    a shared verify link keeps working)."""
    __tablename__ = "wallet_credentials"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    verify_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    subject_name: Mapped[str] = mapped_column(String(255), default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)  # the competence snapshot
    signature: Mapped[str] = mapped_column(String, default="")  # signed JWT (tamper-evident)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class CareerRole(Base):
    """A career-role target for the LMS Skills-to-Opportunity map. Learners see
    how ready they are for each role based on their skill twin. Authored by
    trainers/admins (seedable). Learn-domain only — independent from LARE Hire's
    live drives, per the product-separation rule."""
    __tablename__ = "career_roles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(String(512))
    # [{"name": "SQL", "weight": 2.0}] — skills that define readiness for the role.
    required_skills: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class StudyPlan(Base):
    """The AI coach's persistent, stateful plan for a learner. One active plan
    per learner; regenerated only when their skill profile materially changes,
    so the plan is stable between logins and progress can be tracked against it.
    The scheduled nudger reads this table to remind learners automatically."""
    __tablename__ = "study_plans"

    learner_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan: Mapped[dict] = mapped_column(JSON, default=dict)  # full coach plan payload
    weakest: Mapped[str] = mapped_column(String(128), default="")
    # Signature of the focus areas the plan was built for — regenerate on change.
    profile_sig: Mapped[str] = mapped_column(String(512), default="")
    completed_days: Mapped[list] = mapped_column(JSON, default=list)  # ["Day 1", ...]
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_nudged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    nudge_count: Mapped[int] = mapped_column(Integer, default=0)
