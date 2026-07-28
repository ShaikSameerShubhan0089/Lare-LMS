"""Progress business logic: attendance, module progress, scorecard, year status.

Scorecard dimensions (communication, coding, aptitude, project) are updated as a
running average of their score events. Year completion (PR-4/PR-5) combines
attendance % and average score against the passing threshold, and signals
`year.completed` when met (event emission is a later Phase-0 wiring).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from lare_common.security import new_id

from .models import (
    Attendance, ModuleProgress, Scorecard, ScoreEvent, YearStatus,
)

DIMENSIONS = ("communication", "coding", "aptitude", "project")


def _utcnow():
    return datetime.now(tz=timezone.utc)


class ProgressService:
    def __init__(self, passing_threshold: int = 60):
        self.threshold = passing_threshold

    # ---------- attendance ----------
    def mark_attendance(self, s: Session, data) -> Attendance:
        a = Attendance(id=new_id(), learner_id=data.learner_id,
                       schedule_slot_id=data.schedule_slot_id, status=data.status)
        s.add(a)
        s.flush()
        return a

    def attendance_pct(self, s: Session, learner_id: str) -> float:
        total = s.execute(
            select(func.count(Attendance.id)).where(Attendance.learner_id == learner_id)
        ).scalar_one()
        if not total:
            return 0.0
        present = s.execute(
            select(func.count(Attendance.id)).where(
                Attendance.learner_id == learner_id,
                Attendance.status.in_(("present", "late")),
            )
        ).scalar_one()
        return round(present * 100.0 / total, 1)

    # ---------- module progress ----------
    def set_module_progress(self, s: Session, data) -> ModuleProgress:
        mp = s.execute(
            select(ModuleProgress).where(
                ModuleProgress.learner_id == data.learner_id,
                ModuleProgress.module_id == data.module_id,
            )
        ).scalar_one_or_none()
        if mp is None:
            mp = ModuleProgress(id=new_id(), learner_id=data.learner_id,
                                module_id=data.module_id)
            s.add(mp)
        mp.completion_pct = data.completion_pct
        s.flush()
        return mp

    # ---------- scorecard ----------
    def record_score(self, s: Session, data) -> Scorecard:
        s.add(ScoreEvent(id=new_id(), learner_id=data.learner_id, year_no=data.year_no,
                         dimension=data.dimension, value=data.value,
                         source=data.source, ref_id=data.ref_id))
        s.flush()
        # Recompute the dimension as the average of its events for that year.
        avg = s.execute(
            select(func.avg(ScoreEvent.value)).where(
                ScoreEvent.learner_id == data.learner_id,
                ScoreEvent.year_no == data.year_no,
                ScoreEvent.dimension == data.dimension,
            )
        ).scalar_one()
        card = self._get_or_create_card(s, data.learner_id, data.year_no)
        setattr(card, data.dimension, round(float(avg or 0), 1))
        s.flush()
        return card

    def _get_or_create_card(self, s: Session, learner_id: str, year_no: int) -> Scorecard:
        card = s.execute(
            select(Scorecard).where(
                Scorecard.learner_id == learner_id, Scorecard.year_no == year_no)
        ).scalar_one_or_none()
        if card is None:
            card = Scorecard(id=new_id(), learner_id=learner_id, year_no=year_no)
            s.add(card)
            s.flush()
        return card

    def scorecard(self, s: Session, learner_id: str) -> list[dict]:
        cards = s.execute(
            select(Scorecard).where(Scorecard.learner_id == learner_id)
            .order_by(Scorecard.year_no)
        ).scalars().all()
        return [self.card_out(c) for c in cards]

    # ---------- year status ----------
    def compute_year(self, s: Session, learner_id: str, year_no: int) -> dict:
        card = self._get_or_create_card(s, learner_id, year_no)
        dims = [getattr(card, d) for d in DIMENSIONS]
        scored = [d for d in dims if d > 0]
        avg_score = round(sum(scored) / len(scored), 1) if scored else 0.0
        att = self.attendance_pct(s, learner_id)
        met = avg_score >= self.threshold and att >= self.threshold

        ys = s.execute(
            select(YearStatus).where(
                YearStatus.learner_id == learner_id, YearStatus.year_no == year_no)
        ).scalar_one_or_none()
        if ys is None:
            ys = YearStatus(id=new_id(), learner_id=learner_id, year_no=year_no)
            s.add(ys)
        ys.criteria_met = met
        ys.attendance_pct = att
        ys.avg_score = avg_score
        ys.computed_at = _utcnow()
        s.flush()
        # On met, a `year.completed` event would be published to Certification
        # (event bus wiring is a Phase-0 task).
        return {"learner_id": learner_id, "year_no": year_no, "criteria_met": met,
                "attendance_pct": att, "avg_score": avg_score,
                "threshold": self.threshold, "signal": "year.completed" if met else None}

    def summary(self, s: Session, learner_id: str) -> dict:
        return {
            "learner_id": learner_id,
            "attendance_pct": self.attendance_pct(s, learner_id),
            "scorecard": self.scorecard(s, learner_id),
            "modules": [
                {"module_id": m.module_id, "completion_pct": m.completion_pct}
                for m in s.execute(
                    select(ModuleProgress).where(ModuleProgress.learner_id == learner_id)
                ).scalars().all()
            ],
        }

    @staticmethod
    def card_out(c: Scorecard) -> dict:
        return {"year_no": c.year_no, "communication": c.communication,
                "coding": c.coding, "aptitude": c.aptitude, "project": c.project}
