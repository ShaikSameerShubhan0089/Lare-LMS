"""Assessment business logic: authoring, attempts, auto-grade, manual grade.

Objective items (mcq/multi) auto-grade against the hidden key on submit.
Subjective items are flagged for human grading (optionally seeded by an AI draft
from the AI Orchestration service — advisory, confirmed by a trainer).
When an attempt is fully graded, a `assessment.scored` event would be published
to Progress to update the skill scorecard (event bus wiring is a Phase-0 task).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from lare_common.errors import Conflict, Forbidden, NotFound
from lare_common.security import new_id

from .models import Answer, Assessment, Attempt, Item


def _utcnow():
    return datetime.now(tz=timezone.utc)


class AssessmentService:
    # ---------- authoring ----------
    def create(self, s: Session, data) -> Assessment:
        a = Assessment(
            id=new_id(), title=data.title, year_no=data.year_no, type=data.type,
            time_limit_min=data.time_limit_min, attempts_allowed=data.attempts_allowed,
            passing_pct=data.passing_pct, negative_marking=data.negative_marking,
            dimension=data.dimension, objectives=data.objectives,
            proctored=data.proctored, shuffle=data.shuffle,
        )
        s.add(a)
        s.flush()
        for it in data.items:
            s.add(Item(id=new_id(), assessment_id=a.id, item_type=it.item_type,
                       prompt=it.prompt, options=it.options, correct=it.correct,
                       weight=it.weight, rubric_hint=it.rubric_hint, order=it.order))
        s.flush()
        return a

    def list(self, s: Session, year_no: int | None = None, limit: int = 100) -> list[Assessment]:
        q = select(Assessment)
        if year_no:
            q = q.where(Assessment.year_no == year_no)
        return list(s.execute(q.order_by(Assessment.created_at.desc()).limit(limit)).scalars().all())

    def list_out(self, s: Session, a: Assessment) -> dict:
        n = s.execute(select(func.count(Item.id)).where(Item.assessment_id == a.id)).scalar_one()
        return {**self.out(a), "objectives": a.objectives or [], "item_count": int(n)}

    def get(self, s: Session, aid: str) -> Assessment:
        a = s.get(Assessment, aid)
        if not a:
            raise NotFound("Assessment not found", code="assessment_not_found")
        return a

    def items(self, s: Session, aid: str) -> list[Item]:
        return list(s.execute(
            select(Item).where(Item.assessment_id == aid).order_by(Item.order)
        ).scalars().all())

    # ---------- attempts ----------
    def start(self, s: Session, aid: str, learner_id: str) -> dict:
        a = self.get(s, aid)
        used = s.execute(
            select(func.count(Attempt.id)).where(
                Attempt.assessment_id == aid, Attempt.learner_id == learner_id)
        ).scalar_one()
        if used >= a.attempts_allowed:
            raise Conflict("No attempts remaining", code="attempts_exhausted")
        att = Attempt(id=new_id(), assessment_id=aid, learner_id=learner_id)
        s.add(att)
        s.flush()
        # Return items WITHOUT the answer key.
        return {
            "attempt_id": att.id, "assessment_id": aid, "title": a.title,
            "time_limit_min": a.time_limit_min,
            "items": [self.item_for_attempt(it) for it in self.items(s, aid)],
        }

    def _grade_objective(self, item: Item, response: dict, neg: float) -> float:
        if item.item_type == "mcq":
            chosen = (response or {}).get("option")
            return item.weight if chosen == item.correct.get("option") else -neg
        if item.item_type == "multi":
            chosen = set((response or {}).get("options") or [])
            key = set(item.correct.get("options") or [])
            return item.weight if chosen == key else -neg
        return 0.0  # subjective graded later

    def submit(self, s: Session, attempt_id: str, learner_id: str, answers: dict) -> dict:
        att = s.get(Attempt, attempt_id)
        if not att:
            raise NotFound("Attempt not found", code="attempt_not_found")
        if att.learner_id != learner_id:
            raise Forbidden("Not your attempt")
        if att.status != "in_progress":
            raise Conflict("Attempt already submitted", code="already_submitted")
        a = self.get(s, att.assessment_id)
        items = {it.id: it for it in self.items(s, att.assessment_id)}

        max_score = 0.0
        for it in items.values():
            max_score += it.weight
            resp = answers.get(it.id, {})
            ans = Answer(id=new_id(), attempt_id=att.id, item_id=it.id, response=resp,
                         max_score=it.weight)
            if it.item_type == "subjective":
                ans.needs_grade = True
                ans.auto_score = None
            else:
                ans.auto_score = max(0.0, self._grade_objective(it, resp, a.negative_marking))
            s.add(ans)
        att.max_score = max_score
        att.submitted_at = _utcnow()
        s.flush()
        self._recompute(s, att, a)
        return self.attempt_out(s, att)

    def grade_answer(self, s: Session, answer_id: str, score: float, grader: str) -> dict:
        ans = s.get(Answer, answer_id)
        if not ans:
            raise NotFound("Answer not found", code="answer_not_found")
        if score > ans.max_score:
            raise Conflict("Score exceeds item weight", code="score_too_high")
        ans.final_score = score
        ans.needs_grade = False
        ans.grader_user_id = grader
        s.flush()
        att = s.get(Attempt, ans.attempt_id)
        a = self.get(s, att.assessment_id)
        self._recompute(s, att, a)
        return self.attempt_out(s, att)

    def _recompute(self, s: Session, att: Attempt, a: Assessment) -> None:
        answers = s.execute(
            select(Answer).where(Answer.attempt_id == att.id)
        ).scalars().all()
        score = 0.0
        pending = False
        for ans in answers:
            if ans.needs_grade:
                pending = True
                continue
            val = ans.final_score if ans.final_score is not None else (ans.auto_score or 0.0)
            score += max(0.0, val)
        att.score = round(score, 2)
        att.percentage = round(score * 100.0 / att.max_score, 1) if att.max_score else 0.0
        if pending:
            att.status = "submitted"
            att.passed = False
        else:
            att.status = "graded"
            att.passed = att.percentage >= a.passing_pct
        s.flush()

    def summary(self, s: Session, learner_id: str) -> list[dict]:
        rows = s.execute(
            select(Attempt).where(Attempt.learner_id == learner_id)
        ).scalars().all()
        out = []
        for att in rows:
            a = s.get(Assessment, att.assessment_id)
            out.append({
                "attempt_id": att.id, "assessment": a.title if a else None,
                "year_no": a.year_no if a else None, "dimension": a.dimension if a else None,
                "percentage": att.percentage, "passed": att.passed, "status": att.status,
            })
        return out

    # ---------- Cognitive Twin v0.1 (LMS): learner skill profile ----------
    def skill_profile(self, s: Session, learner_id: str) -> dict:
        """Build an LMS learner's skill model from their assessment history —
        per learning-objective (topic) and per scorecard dimension (category)
        mastery. Reads only LMS assessment data; fully separate from LARE Hire."""
        attempts = s.execute(
            select(Attempt).where(Attempt.learner_id == learner_id)
        ).scalars().all()
        graded = [a for a in attempts if a.status in ("submitted", "graded")]

        a_ids = {a.assessment_id for a in graded}
        assessments = {}
        if a_ids:
            assessments = {a.id: a for a in s.execute(
                select(Assessment).where(Assessment.id.in_(a_ids))).scalars().all()}

        cat_store, topic_store = {}, {}
        tot_att = tot_cor = 0

        def _acc(store: dict, key: str, awarded: float, mx: float, correct: int):
            b = store.setdefault(key, {"attempted": 0, "correct": 0, "awarded": 0.0, "max": 0.0})
            b["attempted"] += 1
            b["correct"] += correct
            b["awarded"] += awarded
            b["max"] += mx

        for att in graded:
            a = assessments.get(att.assessment_id)
            category = (a.dimension if a else None) or (a.type if a else None) or "general"
            objectives = [str(o) for o in ((a.objectives if a else None) or []) if o]
            answers = s.execute(select(Answer).where(Answer.attempt_id == att.id)).scalars().all()
            for ans in answers:
                mx = float(ans.max_score or 0)
                if mx <= 0:
                    continue
                awarded = ans.final_score if ans.final_score is not None else (ans.auto_score or 0)
                awarded = float(awarded or 0)
                correct = 1 if awarded >= mx else 0
                _acc(cat_store, category, awarded, mx, correct)
                for obj in objectives:
                    _acc(topic_store, obj, awarded, mx, correct)
                tot_att += 1
                tot_cor += correct

        def _mastery(b: dict) -> float:
            return round(b["awarded"] * 100.0 / b["max"], 1) if b["max"] else 0.0

        def _band(pct: float) -> str:
            return "strong" if pct >= 80 else ("developing" if pct >= 55 else "weak")

        def _fmt(store: dict, sort: bool = False) -> list[dict]:
            rows = [{"name": k, "attempted": v["attempted"], "correct": v["correct"],
                     "mastery": _mastery(v), "band": _band(_mastery(v))}
                    for k, v in store.items()]
            rows.sort(key=lambda r: (r["mastery"] if sort else 0, r["attempted"]), reverse=sort)
            return rows

        overall_pct = round(
            sum(v["awarded"] for v in cat_store.values()) * 100.0
            / sum(v["max"] for v in cat_store.values()), 1) if cat_store else 0.0
        topics = _fmt(topic_store, sort=True)
        return {
            "learner_id": learner_id,
            "exams_taken": len(graded),
            "overall": {"attempted": tot_att, "correct": tot_cor, "mastery": overall_pct},
            "by_category": _fmt(cat_store),
            "strengths": [t for t in topics if t["band"] == "strong"][:6],
            "focus_areas": sorted([t for t in topics if t["band"] != "strong"],
                                  key=lambda r: r["mastery"])[:6],
            "topics": topics,
        }

    # ---------- serializers ----------
    @staticmethod
    def item_for_attempt(it: Item) -> dict:
        # No answer key sent to the client.
        return {"id": it.id, "item_type": it.item_type, "prompt": it.prompt,
                "options": it.options, "weight": it.weight, "order": it.order}

    @staticmethod
    def out(a: Assessment) -> dict:
        return {"id": a.id, "title": a.title, "year_no": a.year_no, "type": a.type,
                "attempts_allowed": a.attempts_allowed, "passing_pct": a.passing_pct,
                "time_limit_min": a.time_limit_min, "dimension": a.dimension,
                "proctored": bool(a.proctored), "shuffle": bool(a.shuffle)}

    def delivery_items(self, s: Session, a: Assessment, seed: str) -> list[dict]:
        """Items served to a candidate. When shuffle is on, question and option
        order are randomised per student (seeded so a page reload is stable), so
        'the answer is C' and screen-peeking don't help. Grading is by id, so
        order never affects scoring."""
        import random
        rows = [self.item_for_attempt(it) for it in self.items(s, a.id)]
        if a.shuffle:
            random.Random(f"{seed}:{a.id}").shuffle(rows)
            for it in rows:
                opts = list(it.get("options") or [])
                random.Random(f"{seed}:{it['id']}").shuffle(opts)
                it["options"] = opts
        return rows

    def attempt_out(self, s: Session, att: Attempt) -> dict:
        answers = s.execute(select(Answer).where(Answer.attempt_id == att.id)).scalars().all()
        return {
            "attempt_id": att.id, "assessment_id": att.assessment_id,
            "learner_id": att.learner_id, "status": att.status, "score": att.score,
            "max_score": att.max_score, "percentage": att.percentage, "passed": att.passed,
            "pending_grading": [a.id for a in answers if a.needs_grade],
        }
