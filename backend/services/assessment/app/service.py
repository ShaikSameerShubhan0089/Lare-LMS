"""Assessment business logic: authoring, attempts, auto-grade, manual grade.

Objective items (mcq/multi) auto-grade against the hidden key on submit.
Subjective items are flagged for human grading (optionally seeded by an AI draft
from the AI Orchestration service — advisory, confirmed by a trainer).
When an attempt is fully graded, a `assessment.scored` event would be published
to Progress to update the skill scorecard (event bus wiring is a Phase-0 task).
"""
from __future__ import annotations

import logging
import math
import os
import re
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from lare_common.ai import build_client_from_env
from lare_common.errors import Conflict, Forbidden, NotFound
from lare_common.security import new_id, random_token
from lare_common.service_client import ServiceClient

from .models import (
    Answer, Assessment, Attempt, CareerRole, DrillSession, GeneratedLesson, Item,
    PracticeWorld, ReviewItem, StudyPlan, TeachSession, WalletCredential, WorldRun,
)

log = logging.getLogger("lare-assessment")

# East-west client to Auth — resolves a learner's email/name for coach nudges.
_AUTH = ServiceClient("lms-assessment", default_roles=["company_admin"], timeout=5)
# East-west client to the Coding service — pulls a learner's coding-practice
# skill profile so the Twin covers coding, not just written assessments.
_CODING = ServiceClient("lms-assessment", default_roles=["trainer"], timeout=5)


def _coding_skills(learner_id: str) -> dict:
    """Fetch a learner's coding practice profile (per skill + per language).
    Best-effort: if the coding service is down, the Twin still returns written
    assessment data."""
    try:
        resp = _CODING.get("platform-coding",
                           "/lms/v1/practice/skills/{}".format(learner_id))
        return resp or {}
    except Exception:  # noqa: BLE001 — coding is additive; never fail the Twin
        log.warning("could not load coding skills for twin")
        return {}


def _utcnow():
    return datetime.now(tz=timezone.utc)


def _as_utc(dt):
    """Coerce a possibly-naive datetime (e.g. from SQLite) to tz-aware UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


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
                       weight=it.weight, rubric_hint=it.rubric_hint, order=it.order,
                       difficulty=getattr(it, "difficulty", "medium")))
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
        # Resume an in-progress attempt (e.g. a page reload or a crash) instead of
        # creating a new one or burning a try.
        att = s.execute(
            select(Attempt).where(
                Attempt.assessment_id == aid, Attempt.learner_id == learner_id,
                Attempt.status == "in_progress")
        ).scalars().first()
        if att is None:
            # Only completed attempts count toward the limit.
            used = s.execute(
                select(func.count(Attempt.id)).where(
                    Attempt.assessment_id == aid, Attempt.learner_id == learner_id,
                    Attempt.status.in_(("submitted", "graded")))
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
        # Reinforcement: sitting an assessment refreshes the review schedule for
        # each of its skills (objectives) — real practice counts as a review.
        good = (att.percentage or 0) >= a.passing_pct
        for obj in (a.objectives or []):
            try:
                self.record_activity(s, learner_id, str(obj),
                                     float(att.percentage or 0), good, source="written")
            except Exception:  # noqa: BLE001 — reinforcement is best-effort
                log.warning("could not register review for objective %s", obj)
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

        assess_pct = round(
            sum(v["awarded"] for v in cat_store.values()) * 100.0
            / sum(v["max"] for v in cat_store.values()), 1) if cat_store else 0.0
        topics = _fmt(topic_store, sort=True)
        categories = _fmt(cat_store)

        # ---- fuse in coding-practice skills (from the Coding service) ----
        coding = _coding_skills(learner_id)
        code_topics: list[dict] = []
        languages: list[dict] = []
        code_attempted = int(coding.get("attempted") or 0)
        if code_attempted:
            for r in (coding.get("by_skill") or []):
                row = {"name": r["name"], "attempted": r["attempted"],
                       "correct": r["solved"], "mastery": r["mastery"],
                       "band": r["band"], "kind": "coding",
                       "verified": int(r.get("verified") or 0)}
                code_topics.append(row)
            languages = [{"name": r["name"], "attempted": r["attempted"],
                          "solved": r["solved"], "mastery": r["mastery"],
                          "band": r["band"]} for r in (coding.get("by_language") or [])]
            # Coding shows up as its own mastery area alongside written dimensions.
            categories.append({"name": "Coding", "attempted": code_attempted,
                               "correct": int(coding.get("solved") or 0),
                               "mastery": float(coding.get("mastery") or 0),
                               "band": _band(float(coding.get("mastery") or 0))})

        all_topics = topics + code_topics
        all_topics.sort(key=lambda r: (r["mastery"], r["attempted"]), reverse=True)

        # Blend overall: written mastery (weighted by answers) + coding mastery
        # (weighted by problems attempted), so one number reflects both.
        code_mastery = float(coding.get("mastery") or 0)
        denom = tot_att + code_attempted
        overall_pct = round(
            (assess_pct * tot_att + code_mastery * code_attempted) / denom, 1
        ) if denom else 0.0

        return {
            "learner_id": learner_id,
            "exams_taken": len(graded),
            "coding_solved": int(coding.get("solved") or 0),
            "coding_verified": int(coding.get("verified") or 0),
            "coding_attempted": code_attempted,
            "overall": {"attempted": tot_att + code_attempted,
                        "correct": tot_cor + int(coding.get("solved") or 0),
                        "mastery": overall_pct},
            "by_category": categories,
            "languages": languages,
            "strengths": [t for t in all_topics if t["band"] == "strong"][:6],
            "focus_areas": sorted([t for t in all_topics if t["band"] != "strong"],
                                  key=lambda r: r["mastery"])[:6],
            "topics": all_topics,
        }

    # ---------- AI Coach (LMS): a persistent, stateful plan ----------
    @staticmethod
    def _profile_sig(profile: dict) -> str:
        """A compact signature of what the plan targets. When a learner's focus
        areas change (they improve, or new gaps appear), the signature changes
        and the plan is regenerated — otherwise the stored plan is reused."""
        return "|".join("{}:{}".format(t["name"], t["mastery"])
                        for t in (profile.get("focus_areas") or []))

    def coach(self, s: Session, learner_id: str, force: bool = False) -> dict:
        """Return the learner's persistent study plan. Generates a new one (via
        the LMS AI, with a rule-based fallback) only when there is no stored plan,
        the learner's focus areas have shifted, or ``force`` is set. Otherwise the
        previously generated plan is returned, so it's stable across logins and
        progress can be tracked against it."""
        profile = self.skill_profile(s, learner_id)
        base = {
            "overall": profile["overall"], "exams_taken": profile["exams_taken"],
            "focus_areas": profile["focus_areas"], "strengths": profile["strengths"],
        }
        has_data = profile["exams_taken"] > 0 or profile.get("coding_attempted", 0) > 0
        if not has_data:
            return {**base, "plan": None, "completed_days": [],
                    "message": "Take an assessment or solve a practice problem to "
                               "unlock your personalised plan."}

        sig = self._profile_sig(profile)
        row = s.get(StudyPlan, learner_id)
        weakest = (profile["focus_areas"][0]["name"]
                   if profile["focus_areas"] else "your focus areas")

        if row is None or force or row.profile_sig != sig or not (row.plan or {}).get("plan"):
            plan = self._ai_plan(profile)
            if row is None:
                row = StudyPlan(learner_id=learner_id)
                s.add(row)
            row.plan = plan
            row.weakest = weakest
            row.profile_sig = sig
            row.completed_days = []  # a new plan starts fresh
            row.generated_at = _utcnow()
            s.flush()
        else:
            plan = row.plan

        return {**base, "plan": plan, "completed_days": row.completed_days or [],
                "generated_at": row.generated_at.isoformat() if row.generated_at else None}

    def set_day_progress(self, s: Session, learner_id: str, day: str, done: bool) -> dict:
        """Mark a plan day complete/incomplete. Persisted so a learner's progress
        against their plan survives across sessions."""
        row = s.get(StudyPlan, learner_id)
        if row is None:
            raise NotFound("No active plan", code="no_plan")
        days = list(row.completed_days or [])
        if done and day not in days:
            days.append(day)
        elif not done and day in days:
            days.remove(day)
        row.completed_days = days
        s.flush()
        total = len(((row.plan or {}).get("plan")) or [])
        return {"completed_days": days, "total_days": total,
                "complete": total > 0 and len(days) >= total}

    @staticmethod
    def _fallback_plan(focus: list[dict]) -> dict:
        weak = focus[:5]
        top = weak[0]["name"] if weak else None
        plan = [{"day": f"Day {i + 1}",
                 "activity": "Revise {} concepts, then solve 5 practice problems.".format(t["name"])}
                for i, t in enumerate(weak)]
        return {
            "headline": "Your focused plan for the week",
            "explainer": (
                "Your biggest gap is {}. Revise its core idea, work through one solved example "
                "slowly, then explain it aloud in your own words — teaching it back is the fastest "
                "way to make it stick.".format(top)
                if top else "You're strong across the board — keep reviewing to retain it."),
            "focus": [{"topic": t["name"],
                       "why": "You're at {}% here — the biggest gains are waiting.".format(t["mastery"])}
                      for t in weak[:3]],
            "plan": plan or [{"day": "Day 1", "activity": "Keep your strong topics sharp with a quick review."}],
            "practice": ([
                "Solve one easy {} problem and check each step.".format(top),
                "Solve one medium {} problem under a 10-minute timer.".format(top),
                "Explain your {} solution to a friend or in writing.".format(top),
            ] if top else []),
            "quick_win": ("Start today with {} — even 20 focused minutes moves the needle.".format(top)
                          if top else "You're doing great — keep the momentum."),
            "generated": False,
        }

    def _ai_plan(self, profile: dict) -> dict:
        focus = profile["focus_areas"]
        fallback = self._fallback_plan(focus)
        if not focus:
            return fallback
        strong_str = ", ".join(t["name"] for t in profile["strengths"]) or "none yet"
        weak_str = ", ".join("{} ({}%)".format(t["name"], t["mastery"]) for t in focus)
        system = ("You are LARE's encouraging, practical study coach for an engineering student. "
                  "Be specific and motivating, never generic. Keep it concise.")
        top = focus[0]["name"]
        prompt = (
            "Overall mastery: {}%.\n".format(profile["overall"]["mastery"])
            + "Strong topics: {}.\n".format(strong_str)
            + "Weak topics to focus on: {}.\n".format(weak_str)
            + "The single biggest gap is: {}.\n\n".format(top)
            + "Create a personalised study plan targeting the weak topics. Include a clear "
            + "2-minute explanation of the biggest gap, a 5-day plan, and exactly 3 concrete "
            + "practice problems for the weak topics. Return JSON only with this shape:\n"
            + '{"headline": "...", '
            + '"explainer": "a 2-minute, beginner-friendly explanation of ' + top + '", '
            + '"focus": [{"topic": "...", "why": "..."}], '
            + '"plan": [{"day": "Day 1", "activity": "..."}], '
            + '"practice": ["problem 1", "problem 2", "problem 3"], '
            + '"quick_win": "..."}'
        )
        try:
            client = build_client_from_env()
            parsed, res = client.complete_json(
                system=system, messages=[{"role": "user", "content": prompt}],
                fallback=fallback, max_tokens=700)
            parsed = parsed or fallback
            parsed["generated"] = not getattr(res, "stub", True)
            return parsed
        except Exception:  # noqa: BLE001 — never fail the page on an AI hiccup
            log.warning("AI coach generation failed; using rule-based plan")
            return fallback

    def nudge_payload(self, s: Session, learner_id: str) -> dict:
        """Build the coach-nudge event: the learner's weakest area + a short plan
        + their email (resolved from Auth), for the notification service to send.
        Uses the learner's persisted plan (does not regenerate)."""
        coach = self.coach(s, learner_id)
        plan = coach.get("plan") or {}
        focus = coach.get("focus_areas") or []
        weakest = focus[0]["name"] if focus else "your focus areas"
        # Skip days the learner has already completed — nudge on what's left.
        done = set(coach.get("completed_days") or [])
        remaining = [d for d in (plan.get("plan") or []) if d.get("day") not in done]
        plan_lines = ["{}: {}".format(d.get("day"), d.get("activity"))
                      for d in (remaining or plan.get("plan") or [])][:5]
        u = {}
        try:
            resp = _AUTH.get("auth", "/auth/v1/users?ids={}".format(learner_id))
            rows = (resp or {}).get("data") or []
            if rows:
                u = rows[0]
        except Exception:  # noqa: BLE001 — nudge still works in-app without email
            log.warning("could not resolve learner email for coach nudge")
        return {
            "user_id": learner_id,
            "email": u.get("email"),
            "name": (u.get("full_name") or "there").split(" ")[0],
            "weakest": weakest,
            "quick_win": plan.get("quick_win", ""),
            "plan_lines": plan_lines,
            "has_plan": bool(coach.get("plan")),
        }

    def mark_nudged(self, s: Session, learner_id: str) -> None:
        row = s.get(StudyPlan, learner_id)
        if row is not None:
            row.last_nudged_at = _utcnow()
            row.nudge_count = (row.nudge_count or 0) + 1
            s.flush()

    def due_nudges(self, s: Session, days: int = 3, limit: int = 200) -> list[str]:
        """Learners whose plan hasn't been nudged in ``days`` days and who still
        have plan days left to do — the auto-nudger's work list."""
        from datetime import timedelta
        cutoff = _utcnow() - timedelta(days=days)
        rows = s.execute(select(StudyPlan).limit(limit)).scalars().all()
        due = []
        for r in rows:
            plan_days = ((r.plan or {}).get("plan")) or []
            if plan_days and len(r.completed_days or []) >= len(plan_days):
                continue  # plan finished — nothing to nudge about
            if r.last_nudged_at is None or r.last_nudged_at < cutoff:
                due.append(r.learner_id)
        return due

    # ---------- Career readiness (LMS Skills-to-Opportunity) ----------
    def list_careers(self, s: Session) -> list[CareerRole]:
        return list(s.execute(select(CareerRole).order_by(CareerRole.title)).scalars().all())

    def create_career(self, s: Session, data) -> CareerRole:
        c = CareerRole(id=new_id(), title=data.title, description=data.description,
                       required_skills=[{"name": sk.name, "weight": sk.weight}
                                        for sk in (getattr(data, "required_skills", None) or [])])
        s.add(c)
        s.flush()
        return c

    def delete_career(self, s: Session, cid: str) -> dict:
        c = s.get(CareerRole, cid)
        if not c:
            raise NotFound("Career role not found", code="career_not_found")
        s.delete(c)
        s.flush()
        return {"id": cid, "deleted": True}

    def career_readiness(self, s: Session, learner_id: str, threshold: float = 55.0) -> dict:
        """How ready is the learner for each career role? Matches the LMS skill
        twin (written topics + coding skills + languages) against each role's
        required skills. Uses only LMS data — independent of LARE Hire."""
        profile = self.skill_profile(s, learner_id)
        m: dict[str, float] = {}
        for row in (profile.get("topics") or []) + (profile.get("by_category") or []):
            name = str(row.get("name", "")).strip().lower()
            if name:
                m[name] = max(m.get(name, 0.0), float(row.get("mastery") or 0))
        for lang in (profile.get("languages") or []):
            name = str(lang.get("name", "")).strip().lower()
            if name:
                m[name] = max(m.get(name, 0.0), float(lang.get("mastery") or 0))

        readiness = []
        for c in self.list_careers(s):
            req = c.required_skills or []
            if not req:
                continue
            matched, learn_next = [], []
            num = den = 0.0
            for sk in req:
                name = str(sk.get("name", "")).strip()
                if not name:
                    continue
                weight = float(sk.get("weight") or 1.0)
                mastery = m.get(name.lower(), 0.0)
                num += weight * min(mastery, 100.0) / 100.0
                den += weight
                entry = {"name": name, "mastery": round(mastery, 1), "weight": weight}
                (matched if mastery >= threshold else learn_next).append(entry)
            match_pct = round(num / den * 100.0, 1) if den else 0.0
            matched.sort(key=lambda r: r["mastery"], reverse=True)
            learn_next.sort(key=lambda r: (-r["weight"], r["mastery"]))
            readiness.append({
                "id": c.id, "title": c.title, "description": c.description,
                "match_pct": match_pct, "matched": matched, "learn_next": learn_next,
                "required_count": len(req)})
        readiness.sort(key=lambda r: r["match_pct"], reverse=True)
        has_data = profile["exams_taken"] > 0 or profile.get("coding_attempted", 0) > 0
        return {"learner_id": learner_id, "has_data": has_data, "readiness": readiness}

    @staticmethod
    def career_out(c: CareerRole) -> dict:
        return {"id": c.id, "title": c.title, "description": c.description,
                "required_skills": c.required_skills or []}

    # ---------- Lifelong Reinforcement (Sustain): forgetting-aware review ------
    @staticmethod
    def _initial_interval(mastery: float) -> float:
        # Stronger skills decay slower → longer first interval.
        return 7.0 if mastery >= 80 else (3.0 if mastery >= 55 else 1.0)

    @staticmethod
    def _retention(now: datetime, last_reviewed: datetime, interval: float) -> float:
        """Ebbinghaus-style retention: 50% at one interval, decaying after."""
        last_reviewed = _as_utc(last_reviewed)
        if not last_reviewed or interval <= 0:
            return 1.0
        elapsed = max(0.0, (now - last_reviewed).total_seconds() / 86400.0)
        return max(0.0, min(1.0, math.pow(0.5, elapsed / interval)))

    def _ensure_review_items(self, s: Session, learner_id: str, profile: dict) -> None:
        """Lazily create a review schedule for every skill the learner has
        engaged (written + coding), so reinforcement works without wiring an
        event into every practice surface. Weak skills are seeded already-due."""
        now = _utcnow()
        existing = set(s.execute(
            select(ReviewItem.skill).where(ReviewItem.learner_id == learner_id)).scalars().all())
        for t in (profile.get("topics") or []):
            name = t.get("name")
            if not name or name in existing or int(t.get("attempted") or 0) <= 0:
                continue
            mastery = float(t.get("mastery") or 0)
            interval = self._initial_interval(mastery)
            # Seed "time since practice" from mastery: weak → overdue now,
            # developing → due soon, strong → due later. Keeps due_at & retention
            # consistent (both derive from last_reviewed + interval).
            factor = 1.2 if mastery < 55 else (0.5 if mastery < 80 else 0.2)
            last = now - timedelta(days=interval * factor)
            s.add(ReviewItem(
                id=new_id(), learner_id=learner_id, skill=name,
                source=("coding" if t.get("kind") == "coding" else "written"),
                interval_days=interval, ease=2.0, review_count=0,
                last_mastery=mastery, last_reviewed_at=last,
                due_at=last + timedelta(days=interval)))
        s.flush()

    def review_queue(self, s: Session, learner_id: str) -> dict:
        """Skills due (or soon due) for a maintenance review, worst retention
        first. The heart of keeping knowledge alive instead of certified-and-lost."""
        profile = self.skill_profile(s, learner_id)
        self._ensure_review_items(s, learner_id, profile)
        now = _utcnow()
        rows = s.execute(select(ReviewItem).where(
            ReviewItem.learner_id == learner_id)).scalars().all()
        due, upcoming = [], []
        for r in rows:
            retention = self._retention(now, r.last_reviewed_at, r.interval_days)
            due_at = _as_utc(r.due_at)
            is_due = due_at <= now
            days_to_due = round((due_at - now).total_seconds() / 86400.0, 1)
            entry = {
                "skill": r.skill, "source": r.source,
                "retention": round(retention * 100, 1),
                "review_count": r.review_count, "interval_days": round(r.interval_days, 1),
                "mastery": round(r.last_mastery, 1),
                "due": is_due, "days_to_due": days_to_due,
            }
            (due if is_due else upcoming).append(entry)
        due.sort(key=lambda e: e["retention"])
        upcoming.sort(key=lambda e: e["days_to_due"])
        return {"learner_id": learner_id, "due_count": len(due),
                "due": due, "upcoming": upcoming[:8]}

    def mark_reviewed(self, s: Session, learner_id: str, skill: str,
                      outcome: str) -> dict:
        """Self-check review: 'good' grows the interval (SM-2 style) so the skill
        resurfaces later; 'rusty' resets it to tomorrow. Reschedules the item."""
        r = s.execute(select(ReviewItem).where(
            ReviewItem.learner_id == learner_id, ReviewItem.skill == skill)
        ).scalars().first()
        if r is None:
            raise NotFound("No such review item", code="review_not_found")
        now = _utcnow()
        if outcome == "good":
            r.ease = min(2.6, (r.ease or 2.0) + 0.1)
            r.review_count = (r.review_count or 0) + 1
            r.interval_days = max(1.0, (r.interval_days or 1.0) * r.ease)
        else:  # rusty
            r.ease = max(1.3, (r.ease or 2.0) - 0.2)
            r.interval_days = 1.0
        r.last_reviewed_at = now
        r.due_at = now + timedelta(days=r.interval_days)
        s.flush()
        return {"skill": skill, "interval_days": round(r.interval_days, 1),
                "next_due_in_days": round(r.interval_days, 1),
                "review_count": r.review_count}

    def record_activity(self, s: Session, learner_id: str, skill: str,
                        mastery: float, good: bool, source: str = "written") -> None:
        """Auto-register/refresh a review when a learner actually practises a
        skill (e.g. sits an assessment). Real practice counts as a review."""
        if not skill:
            return
        now = _utcnow()
        r = s.execute(select(ReviewItem).where(
            ReviewItem.learner_id == learner_id, ReviewItem.skill == skill)
        ).scalars().first()
        if r is None:
            r = ReviewItem(id=new_id(), learner_id=learner_id, skill=skill,
                           source=source, interval_days=self._initial_interval(mastery),
                           ease=2.0, review_count=0)
            s.add(r)
        if good:
            r.ease = min(2.6, (r.ease or 2.0) + 0.1)
            r.review_count = (r.review_count or 0) + 1
            r.interval_days = max(1.0, (r.interval_days or 1.0) * r.ease)
        else:
            r.ease = max(1.3, (r.ease or 2.0) - 0.2)
            r.interval_days = 1.0
        r.last_mastery = mastery
        r.last_reviewed_at = now
        r.due_at = now + timedelta(days=r.interval_days)
        s.flush()

    # ---------- Sovereign Learning Wallet (Own): signed, verifiable ----------
    @staticmethod
    def _wallet_secret() -> str:
        return (os.getenv("WALLET_SIGNING_SECRET")
                or os.getenv("INTERNAL_JWT_SECRET", "dev-internal-secret-change-me"))

    def _resolve_name(self, learner_id: str) -> str:
        try:
            resp = _AUTH.get("auth", "/auth/v1/users?ids={}".format(learner_id))
            rows = (resp or {}).get("data") or []
            if rows:
                return rows[0].get("full_name") or "LARE Learner"
        except Exception:  # noqa: BLE001
            log.warning("could not resolve learner name for wallet")
        return "LARE Learner"

    def _build_wallet_payload(self, s: Session, learner_id: str) -> dict:
        profile = self.skill_profile(s, learner_id)
        topics = profile.get("topics") or []
        strong = [t["name"] for t in topics if t.get("band") == "strong"][:10]
        verified_coding = [t["name"] for t in topics
                           if t.get("kind") == "coding" and int(t.get("verified") or 0) > 0]
        careers = self.career_readiness(s, learner_id).get("readiness", [])
        top = careers[0] if careers else None
        return {
            "overall_mastery": profile["overall"]["mastery"],
            "exams_taken": profile.get("exams_taken", 0),
            "coding_solved": profile.get("coding_solved", 0),
            "coding_verified": profile.get("coding_verified", 0),
            "proven_strengths": strong,
            "verified_coding_skills": verified_coding,
            "top_career": ({"title": top["title"], "match_pct": top["match_pct"]}
                           if top else None),
            "issuer": "LARE Learn",
        }

    def issue_wallet(self, s: Session, learner_id: str) -> dict:
        payload = self._build_wallet_payload(s, learner_id)
        name = self._resolve_name(learner_id)
        row = s.execute(select(WalletCredential).where(
            WalletCredential.learner_id == learner_id)).scalars().first()
        if row is None:
            row = WalletCredential(id=new_id(), learner_id=learner_id,
                                   verify_id=random_token(10))
            s.add(row)
        row.subject_name = name
        row.payload = payload
        row.revoked = False
        row.issued_at = _utcnow()
        claims = {"sub": learner_id, "verify_id": row.verify_id, "name": name,
                  "vc": payload, "iat": int(_utcnow().timestamp()), "iss": "lare-wallet"}
        row.signature = jwt.encode(claims, self._wallet_secret(), algorithm="HS256")
        s.flush()
        return self.wallet_out(row, include_signature=True)

    def get_wallet(self, s: Session, learner_id: str) -> dict | None:
        row = s.execute(select(WalletCredential).where(
            WalletCredential.learner_id == learner_id)).scalars().first()
        return self.wallet_out(row, include_signature=True) if row else None

    def verify_wallet(self, s: Session, verify_id: str) -> dict:
        """PUBLIC: confirm a shared credential is authentic and current. Checks
        the tamper-evident signature and that it hasn't been revoked."""
        row = s.execute(select(WalletCredential).where(
            WalletCredential.verify_id == verify_id)).scalars().first()
        if row is None:
            return {"valid": False, "reason": "not_found"}
        if row.revoked:
            return {"valid": False, "reason": "revoked", "subject_name": row.subject_name}
        try:
            decoded = jwt.decode(row.signature, self._wallet_secret(),
                                 algorithms=["HS256"], options={"verify_aud": False})
        except Exception:  # noqa: BLE001 — any signature failure = not authentic
            return {"valid": False, "reason": "signature_invalid"}
        if decoded.get("verify_id") != verify_id:
            return {"valid": False, "reason": "signature_mismatch"}
        return {"valid": True, "subject_name": row.subject_name,
                "issued_at": row.issued_at.isoformat() if row.issued_at else None,
                "credential": row.payload}

    def revoke_wallet(self, s: Session, learner_id: str) -> dict:
        row = s.execute(select(WalletCredential).where(
            WalletCredential.learner_id == learner_id)).scalars().first()
        if row is None:
            raise NotFound("No wallet credential", code="no_wallet")
        row.revoked = True
        s.flush()
        return {"revoked": True, "verify_id": row.verify_id}

    def wallet_pdf_lines(self, cred: dict) -> list[str]:
        vc = cred.get("credential") or {}
        lines = [
            "Holder: {}".format(cred.get("subject_name") or "LARE Learner"),
            "Issued: {}".format((cred.get("issued_at") or "")[:10]),
            "Verify at: /verify/wallet/{}".format(cred.get("verify_id")),
            "",
            "Overall mastery: {}%".format(vc.get("overall_mastery", 0)),
            "Assessments taken: {}".format(vc.get("exams_taken", 0)),
            "Coding problems solved: {}".format(vc.get("coding_solved", 0)),
            "Verified (viva-proven) coding skills: {}".format(vc.get("coding_verified", 0)),
            "",
            "Proven strengths: {}".format(", ".join(vc.get("proven_strengths") or []) or "—"),
            "Verified coding: {}".format(", ".join(vc.get("verified_coding_skills") or []) or "—"),
        ]
        if vc.get("top_career"):
            lines.append("Top career readiness: {} ({}%)".format(
                vc["top_career"]["title"], vc["top_career"]["match_pct"]))
        return lines

    @staticmethod
    def wallet_out(row: WalletCredential, include_signature: bool = False) -> dict:
        d = {"verify_id": row.verify_id, "subject_name": row.subject_name,
             "issued_at": row.issued_at.isoformat() if row.issued_at else None,
             "revoked": bool(row.revoked), "credential": row.payload or {}}
        if include_signature:
            d["signature"] = row.signature
        return d

    # ---------- Embodied Practice Worlds: browser workplace simulation --------
    def create_world(self, s: Session, data) -> PracticeWorld:
        steps = [st.model_dump() if hasattr(st, "model_dump") else st
                 for st in (getattr(data, "steps", None) or [])]
        # ensure each step/option has an id
        for i, st in enumerate(steps):
            st.setdefault("id", "s{}".format(i + 1))
            for j, opt in enumerate(st.get("options") or []):
                opt.setdefault("id", "abcdef"[j] if j < 6 else str(j))
        w = PracticeWorld(id=new_id(), title=data.title, role=data.role,
                          skill=data.skill, difficulty=data.difficulty,
                          summary=data.summary, steps=steps,
                          pass_pct=data.pass_pct)
        s.add(w)
        s.flush()
        return w

    def list_worlds(self, s: Session) -> list[dict]:
        rows = s.execute(select(PracticeWorld).order_by(
            PracticeWorld.difficulty, PracticeWorld.title)).scalars().all()
        return [self.world_card(w) for w in rows]

    def get_world(self, s: Session, wid: str) -> PracticeWorld:
        w = s.get(PracticeWorld, wid)
        if not w:
            raise NotFound("Practice world not found", code="world_not_found")
        return w

    def start_world(self, s: Session, learner_id: str, world_id: str) -> dict:
        w = self.get_world(s, world_id)
        # resume an in-progress run, else start fresh
        run = s.execute(select(WorldRun).where(
            WorldRun.world_id == world_id, WorldRun.learner_id == learner_id,
            WorldRun.status == "in_progress")).scalars().first()
        if run is None:
            run = WorldRun(id=new_id(), world_id=world_id, learner_id=learner_id,
                           step_index=0, answers={}, correct_count=0)
            s.add(run)
            s.flush()
        steps = w.steps or []
        idx = min(run.step_index, max(0, len(steps) - 1))
        return {"run_id": run.id, "world": self.world_card(w),
                "total_steps": len(steps), "step_index": idx,
                "step": self._world_step_public(steps[idx]) if steps else None}

    def answer_world(self, s: Session, learner_id: str, run_id: str,
                     step_id: str, choice: str) -> dict:
        run = s.get(WorldRun, run_id)
        if run is None:
            raise NotFound("Run not found", code="run_not_found")
        if run.learner_id != learner_id:
            raise Forbidden("Not your run")
        if run.status != "in_progress":
            raise Conflict("Run already completed", code="run_done")
        w = self.get_world(s, run.world_id)
        steps = w.steps or []
        step = next((st for st in steps if st.get("id") == step_id), None)
        if step is None:
            raise NotFound("Step not found", code="step_not_found")
        if step_id in (run.answers or {}):
            raise Conflict("Step already answered", code="step_answered")
        opt = next((o for o in (step.get("options") or []) if o.get("id") == choice), None)
        correct = bool(opt and opt.get("correct"))
        answers = dict(run.answers or {})
        answers[step_id] = {"choice": choice, "correct": correct}
        run.answers = answers
        if correct:
            run.correct_count += 1
        run.step_index = min(run.step_index + 1, len(steps))
        s.flush()

        done = run.step_index >= len(steps)
        result = {"correct": correct,
                  "feedback": (opt or {}).get("feedback", ""),
                  "correct_choice": next((o["id"] for o in (step.get("options") or [])
                                          if o.get("correct")), None),
                  "progress": {"answered": len(answers), "total": len(steps)}}
        if done:
            result["done"] = True
            result["summary"] = self._finish_world(s, run, w)
        else:
            result["done"] = False
            result["next_step"] = self._world_step_public(steps[run.step_index])
        return result

    def _finish_world(self, s: Session, run: WorldRun, w: PracticeWorld) -> dict:
        total = len(w.steps or [])
        score = round(run.correct_count * 100.0 / total, 1) if total else 0.0
        run.score = score
        run.status = "completed"
        s.flush()
        passed = score >= (w.pass_pct or 60)
        # Feed the twin: an embodied run is real practice of a skill.
        if w.skill:
            try:
                self.record_activity(s, run.learner_id, w.skill, score,
                                     good=passed, source="written")
            except Exception:  # noqa: BLE001
                log.warning("could not register world activity")
        return {"score": score, "correct": run.correct_count, "total": total,
                "passed": passed, "skill": w.skill, "role": w.role}

    @staticmethod
    def world_card(w: PracticeWorld) -> dict:
        return {"id": w.id, "title": w.title, "role": w.role, "skill": w.skill,
                "difficulty": w.difficulty, "summary": w.summary,
                "steps": len(w.steps or []), "pass_pct": w.pass_pct}

    @staticmethod
    def _world_step_public(step: dict) -> dict:
        """A step as shown to the learner — option correctness/feedback withheld."""
        return {"id": step.get("id"), "situation": step.get("situation"),
                "artifact": step.get("artifact"), "prompt": step.get("prompt"),
                "options": [{"id": o.get("id"), "text": o.get("text")}
                            for o in (step.get("options") or [])]}

    # ---------- Generative Learning Fabric: on-demand micro-lessons ----------
    # A lesson is a list of rich, interactive BLOCKS (text w/ markdown + tables,
    # runnable code, callouts, checks) — the same format the curriculum editor
    # uses — so "class material" is detailed and consistent everywhere.
    @staticmethod
    def _clean_lesson_blocks(blocks) -> list:
        out = []
        for i, b in enumerate(blocks or []):
            if not isinstance(b, dict):
                continue
            t = b.get("type")
            if t not in ("text", "code", "callout", "check"):
                continue
            b.setdefault("id", "b{}".format(i + 1))
            if t == "check":
                opts = b.get("options") or []
                for j, o in enumerate(opts):
                    if isinstance(o, dict):
                        o.setdefault("id", "abcd"[j] if j < 4 else str(j))
                if not (b.get("question") or "").strip() or len(opts) < 2:
                    continue
            out.append(b)
        return out

    @staticmethod
    def _fallback_blocks(topic: str) -> dict:
        return {
            "title": "A quick primer on {}".format(topic),
            "blocks": [
                {"type": "text", "id": "b1",
                 "html": "## {t}\n\nLet's build **{t}** from the ground up.\n\n"
                         "Focus on one idea at a time, run the example, then take the "
                         "check at the end — that's what makes it stick.".format(t=topic)},
                {"type": "callout", "id": "b2", "tone": "info",
                 "text": "The key with {}: understand the setup before reaching for a "
                         "formula.".format(topic)},
                {"type": "code", "id": "b3", "language": "python",
                 "code": "# A tiny {} example — run and tweak it\nprint('hello')".format(topic),
                 "note": "Change something and re-run to see what happens."},
                {"type": "check", "id": "b4", "skill": topic,
                 "question": "When should you reach for {}?".format(topic),
                 "options": [{"id": "a", "text": "When it fits the problem's structure"},
                             {"id": "b", "text": "Always, no matter the problem"}],
                 "answer": "a",
                 "explain": "Pick the tool that matches the problem in front of you."},
            ],
            "generated": False,
        }

    @staticmethod
    def _parse_lesson_markup(text: str, topic: str) -> dict:
        """Parse the AI's @@ marker format into lesson blocks. Robust to code,
        tables, quotes and newlines (unlike JSON) — the model can't easily break it."""
        title = ""
        blocks = []
        cur_type, cur_arg, buf = None, "", []

        def flush():
            nonlocal cur_type, cur_arg, buf
            if cur_type in (None, "_title"):
                buf = []
                return
            body = "\n".join(buf).strip("\n")
            if cur_type == "text" and body.strip():
                blocks.append({"type": "text", "html": body})
            elif cur_type == "code" and body.strip():
                lang = (cur_arg or "python").strip().lower() or "python"
                blocks.append({"type": "code", "language": lang, "code": body})
            elif cur_type == "callout" and body.strip():
                tone = (cur_arg or "info").strip().lower()
                tone = tone if tone in ("tip", "info", "warning") else "info"
                blocks.append({"type": "callout", "tone": tone, "text": body.strip()})
            elif cur_type == "check":
                q, opts, answer, explain, skill = "", [], "a", "", topic
                for ln in buf:
                    s = ln.strip()
                    mo = re.match(r"^[-*]?\s*([A-Da-d])[).]\s*(.+)$", s)
                    if s[:2].upper() == "Q:":
                        q = s[2:].strip()
                    elif s.upper().startswith("CORRECT:"):
                        answer = (s.split(":", 1)[1].strip().lower() or "a")[:1]
                    elif s.upper().startswith("EXPLAIN:"):
                        explain = s.split(":", 1)[1].strip()
                    elif s.upper().startswith("SKILL:"):
                        skill = s.split(":", 1)[1].strip() or topic
                    elif mo:
                        opts.append({"id": mo.group(1).lower(), "text": mo.group(2).strip()})
                if q and len(opts) >= 2:
                    if answer not in [o["id"] for o in opts]:
                        answer = opts[0]["id"]
                    blocks.append({"type": "check", "skill": skill, "question": q,
                                   "options": opts, "answer": answer, "explain": explain})
            buf = []

        for raw in (text or "").splitlines():
            line = raw.rstrip("\r")
            if line.strip() in ("```", "```json", "```md", "```markdown", "```text"):
                continue
            m = re.match(r"^\s*@@(TITLE|TEXT|CODE|CALLOUT|CHECK)\b[ \t]*(.*)$", line, re.I)
            if m:
                flush()
                kind = m.group(1).lower()
                if kind == "title":
                    t = m.group(2).strip()
                    if t:
                        title = t
                    cur_type, cur_arg = "_title", ""
                else:
                    cur_type, cur_arg = kind, m.group(2).strip()
                continue
            if cur_type == "_title":
                if line.strip():
                    title = line.strip()
                    cur_type = None
                continue
            if cur_type is not None:
                buf.append(line)
        flush()
        return {"title": title or "A guide to {}".format(topic[:60]), "blocks": blocks}

    def _ai_blocks(self, topic: str, mastery: float) -> dict:
        fallback = self._fallback_blocks(topic)
        system = ("You are LARE's expert tutor writing complete, textbook-quality yet "
                  "spoon-fed study material a beginner can follow end-to-end. Go deep: "
                  "define terms, give a shared worked example, cover EVERY sub-type or "
                  "variant of the topic, and always explain the WHY. Prefer thorough "
                  "over brief — this is the learner's primary study material.")
        prompt = (
            "Teach this COMPLETELY: {}\nLearner mastery: {}% — pitch accordingly.\n\n".format(topic, mastery)
            + "Output ONLY blocks in this EXACT marker format — no JSON, and do NOT "
            + "wrap the whole answer in backticks. Begin each block with a line "
            + "starting '@@':\n\n"
            + "@@TITLE\n<a short lesson title>\n"
            + "@@TEXT\n<rich markdown: headings, **bold**, bullet lists, and Markdown "
            + "| tables | — use tables for example data AND for showing expected results>\n"
            + "@@CODE sql\n<a real example with sample data — plain code, no backticks>\n"
            + "@@CALLOUT tip\n<a tip, key idea, or common trap>\n"
            + "@@CHECK\nQ: <question>\nA) <option>\nB) <option>\nC) <option>\nCORRECT: B\n"
            + "EXPLAIN: <one line why>\nSKILL: {}\n\n".format(topic[:40])
            + "STRUCTURE (be exhaustive):\n"
            + "1. @@TITLE, then a @@TEXT intro (what it is + why it matters).\n"
            + "2. A @@TEXT with a shared example dataset shown as Markdown tables.\n"
            + "3. For EVERY sub-type / variant of the topic: a @@TEXT (purpose + a "
            + "plain-English analogy + when to use it), a @@CODE example using the shared "
            + "data, and a @@TEXT showing the expected RESULT as a Markdown table.\n"
            + "4. At least two @@CALLOUTs (a tip and a common trap).\n"
            + "5. Two @@CHECK questions at the end.\n"
            + "Produce as many blocks as needed to be complete (typically 12-20). "
            + "Do not cut it short."
        )
        import time
        transient = False
        for attempt in range(3):  # the model 503s under load — retry a couple times
            try:
                client = build_client_from_env()
                res = client.complete(system=system,
                                      messages=[{"role": "user", "content": prompt}],
                                      max_tokens=7000)
                if getattr(res, "stub", True):
                    # distinguish "no AI configured" from a temporary outage
                    if getattr(res, "error", "") in ("rate_limited", "provider_error"):
                        transient = True
                        time.sleep(1.5 * (attempt + 1))
                        continue
                    break  # no key / permanent stub → use fallback
                parsed = self._parse_lesson_markup(res.text, topic)
                blocks = self._clean_lesson_blocks(parsed.get("blocks"))
                if len(blocks) < 2:
                    break
                return {"title": parsed.get("title"), "blocks": blocks, "generated": True}
            except Exception:  # noqa: BLE001
                transient = True
                time.sleep(1.5 * (attempt + 1))
        # Signal a temporary outage so the caller can ask the user to retry
        # instead of persisting the generic template.
        return {**fallback, "transient": transient}

    def author_blocks(self, topic: str, mastery: float = 0.0) -> dict:
        """Generate lesson blocks for an author to review/edit (no storage).
        Powers the Curriculum Studio 'AI generate material' button."""
        topic = (topic or "").strip()
        if not topic:
            raise Conflict("A topic is required", code="topic_required")
        out = self._ai_blocks(topic, mastery)
        if out.get("transient"):
            raise Conflict("The AI is busy right now — please try again in a moment.",
                           code="ai_busy")
        return out

    def generate_lesson(self, s: Session, learner_id: str, topic: str,
                        force: bool = False) -> dict:
        topic = (topic or "").strip()
        if not topic:
            raise Conflict("A topic is required", code="topic_required")
        row = s.execute(select(GeneratedLesson).where(
            GeneratedLesson.learner_id == learner_id,
            GeneratedLesson.topic == topic)).scalars().first()
        if row is not None and not force:
            return self.lesson_out(row)
        profile = self.skill_profile(s, learner_id)
        mastery = 0.0
        for t in (profile.get("topics") or []):
            if str(t.get("name", "")).lower() == topic.lower():
                mastery = float(t.get("mastery") or 0)
                break
        lesson = self._ai_blocks(topic, mastery)
        # Don't persist the generic template when the AI was merely busy — let the
        # learner retry and get the real lesson.
        if lesson.get("transient") and row is None:
            raise Conflict("The AI is busy right now — please try again in a moment.",
                           code="ai_busy")
        lesson.pop("transient", None)
        if row is None:
            row = GeneratedLesson(id=new_id(), learner_id=learner_id, topic=topic)
            s.add(row)
        row.lesson = lesson
        row.generated = bool(lesson.get("generated"))
        row.created_at = _utcnow()
        s.flush()
        return self.lesson_out(row)

    def list_lessons(self, s: Session, learner_id: str) -> list[dict]:
        rows = s.execute(select(GeneratedLesson).where(
            GeneratedLesson.learner_id == learner_id)
            .order_by(GeneratedLesson.created_at.desc())).scalars().all()
        return [{"topic": r.topic, "title": (r.lesson or {}).get("title", r.topic),
                 "generated": r.generated,
                 "created_at": r.created_at.isoformat() if r.created_at else None}
                for r in rows]

    @staticmethod
    def lesson_out(row: GeneratedLesson) -> dict:
        return {"topic": row.topic, "lesson": row.lesson or {},
                "generated": bool(row.generated),
                "created_at": row.created_at.isoformat() if row.created_at else None}

    # ---------- Human Knowledge Mesh: AI-matched peer teach-back ----------
    def _topic_masteries(self, s: Session, topic: str) -> dict[str, float]:
        """learner_id -> mastery% on one topic, across everyone who has attempted
        assessments tagged with it. The index the mesh matches against."""
        tl = topic.strip().lower()
        assessments = s.execute(select(Assessment)).scalars().all()
        aids = {a.id for a in assessments
                if tl in [str(o).lower() for o in (a.objectives or [])]
                or (a.dimension or "").lower() == tl}
        if not aids:
            return {}
        attempts = s.execute(select(Attempt).where(
            Attempt.assessment_id.in_(aids),
            Attempt.status.in_(("submitted", "graded")))).scalars().all()
        acc: dict[str, list] = {}
        for att in attempts:
            answers = s.execute(select(Answer).where(Answer.attempt_id == att.id)).scalars().all()
            for ans in answers:
                mx = float(ans.max_score or 0)
                if mx <= 0:
                    continue
                awarded = ans.final_score if ans.final_score is not None else (ans.auto_score or 0)
                a = acc.setdefault(att.learner_id, [0.0, 0.0])
                a[0] += float(awarded or 0)
                a[1] += mx
        return {lid: round(v[0] * 100.0 / v[1], 1) for lid, v in acc.items() if v[1] > 0}

    def mesh_overview(self, s: Session, learner_id: str) -> dict:
        """For a learner: topics where peers can mentor them (they're weak, others
        strong), and topics where they can mentor others (they're strong). Weak
        peers are never named — only the seeker initiates a request."""
        profile = self.skill_profile(s, learner_id)
        my_topics = [t for t in (profile.get("topics") or [])
                     if int(t.get("attempted") or 0) > 0 and t.get("kind") != "coding"]
        get_help, can_teach = [], []
        mentor_ids: set[str] = set()
        for t in my_topics:
            name = t["name"]
            masteries = self._topic_masteries(s, name)
            mine = masteries.get(learner_id, t.get("mastery", 0))
            if t.get("band") != "strong":  # I could use a mentor here
                mentors = sorted(
                    [{"id": lid, "mastery": m} for lid, m in masteries.items()
                     if lid != learner_id and m >= 80],
                    key=lambda r: r["mastery"], reverse=True)[:5]
                if mentors:
                    for m in mentors:
                        mentor_ids.add(m["id"])
                    get_help.append({"topic": name, "my_mastery": mine, "mentors": mentors})
            else:  # I'm strong — I could teach
                seekers = [lid for lid, m in masteries.items()
                           if lid != learner_id and m < 55]
                can_teach.append({"topic": name, "my_mastery": mine,
                                  "seekers": len(seekers)})
        names = self._resolve_names_map(mentor_ids)
        for g in get_help:
            for m in g["mentors"]:
                m["name"] = names.get(m["id"], "A peer")
        get_help.sort(key=lambda g: g["my_mastery"])
        can_teach.sort(key=lambda c: c["seekers"], reverse=True)
        return {"learner_id": learner_id, "get_help": get_help, "can_teach": can_teach}

    def _resolve_names_map(self, ids: set[str]) -> dict[str, str]:
        ids = [i for i in ids if i]
        if not ids:
            return {}
        try:
            resp = _AUTH.get("auth", "/auth/v1/users?ids=" + ",".join(ids))
            return {u["id"]: (u.get("full_name") or "A peer")
                    for u in (resp or {}).get("data", [])}
        except Exception:  # noqa: BLE001
            return {}

    def request_teach(self, s: Session, requester_id: str, topic: str,
                      mentor_id: str, note: str | None = None) -> dict:
        if mentor_id == requester_id:
            raise Conflict("You can't request yourself", code="self_request")
        existing = s.execute(select(TeachSession).where(
            TeachSession.topic == topic, TeachSession.teacher_id == mentor_id,
            TeachSession.learner_id == requester_id,
            TeachSession.status.in_(("requested", "accepted")))).scalars().first()
        if existing is not None:
            return self.teach_out(s, existing)
        ts = TeachSession(id=new_id(), topic=topic, teacher_id=mentor_id,
                          learner_id=requester_id, requested_by=requester_id,
                          status="requested", note=note)
        s.add(ts)
        s.flush()
        return self.teach_out(s, ts)

    def respond_teach(self, s: Session, session_id: str, user_id: str,
                      accept: bool) -> dict:
        ts = s.get(TeachSession, session_id)
        if ts is None:
            raise NotFound("Session not found", code="teach_not_found")
        if ts.teacher_id != user_id:
            raise Forbidden("Only the mentor can respond")
        if ts.status != "requested":
            raise Conflict("Already responded", code="already_responded")
        ts.status = "accepted" if accept else "declined"
        s.flush()
        return self.teach_out(s, ts)

    def complete_teach(self, s: Session, session_id: str, user_id: str) -> dict:
        ts = s.get(TeachSession, session_id)
        if ts is None:
            raise NotFound("Session not found", code="teach_not_found")
        if user_id not in (ts.teacher_id, ts.learner_id):
            raise Forbidden("Not your session")
        ts.status = "completed"
        s.flush()
        return self.teach_out(s, ts)

    def my_teach_sessions(self, s: Session, user_id: str) -> dict:
        rows = s.execute(select(TeachSession).where(
            (TeachSession.teacher_id == user_id) | (TeachSession.learner_id == user_id))
            .order_by(TeachSession.created_at.desc())).scalars().all()
        ids = {r.teacher_id for r in rows} | {r.learner_id for r in rows}
        names = self._resolve_names_map(ids)
        as_mentor, as_learner = [], []
        for r in rows:
            d = self.teach_out(s, r, names)
            (as_mentor if r.teacher_id == user_id else as_learner).append(d)
        return {"as_mentor": as_mentor, "as_learner": as_learner}

    @staticmethod
    def teach_out(s: Session, ts: TeachSession, names: dict | None = None) -> dict:
        names = names or {}
        return {"id": ts.id, "topic": ts.topic, "status": ts.status,
                "teacher_id": ts.teacher_id, "learner_id": ts.learner_id,
                "teacher_name": names.get(ts.teacher_id, "Mentor"),
                "learner_name": names.get(ts.learner_id, "Learner"),
                "note": ts.note,
                "created_at": ts.created_at.isoformat() if ts.created_at else None}

    # ---------- Flow layer: adaptive drill (keep the learner in flow) ---------
    _LEVELS = ["easy", "medium", "hard"]
    _FAST_MS = 15000  # an MCQ answered within 15s counts as "fast" (confident)

    def _drill_pool(self, s: Session, topic: str | None, difficulty: str,
                    exclude: set[str]) -> list[Item]:
        """MCQ items at a difficulty, optionally scoped to a topic (matched
        against the parent assessment's objectives)."""
        items = s.execute(select(Item).where(
            Item.item_type == "mcq", Item.difficulty == difficulty)).scalars().all()
        if not items:
            return []
        if not topic:
            return [it for it in items if it.id not in exclude]
        # scope by topic via the parent assessment's objectives
        aids = {it.assessment_id for it in items}
        assessments = {a.id: a for a in s.execute(
            select(Assessment).where(Assessment.id.in_(aids))).scalars().all()}
        tl = topic.strip().lower()
        out = []
        for it in items:
            if it.id in exclude:
                continue
            a = assessments.get(it.assessment_id)
            objs = [str(o).lower() for o in ((a.objectives if a else None) or [])]
            if tl in objs or (a and (a.dimension or "").lower() == tl):
                out.append(it)
        return out

    def _ai_drill_question(self, topic: str | None, difficulty: str) -> dict | None:
        """Generate ONE real MCQ at a difficulty via the LMS AI. Returns a dict
        with the answer key (kept server-side), or None if AI is unavailable."""
        subject = topic or "core computer science and aptitude"
        system = ("You are LARE's exam author. Write ONE high-quality multiple-choice "
                  "question. Make distractors plausible. Exactly one correct option. "
                  "Match the requested difficulty precisely.")
        prompt = (
            "Topic: {}\nDifficulty: {}\n\n".format(subject, difficulty)
            + 'Return JSON ONLY: {"question":"...",'
            + '"options":[{"id":"a","text":"..."},{"id":"b","text":"..."},'
            + '{"id":"c","text":"..."},{"id":"d","text":"..."}],'
            + '"answer":"a","explain":"one sentence why"}'
        )
        try:
            client = build_client_from_env()
            parsed, res = client.complete_json(
                system=system, messages=[{"role": "user", "content": prompt}],
                fallback={}, max_tokens=500)
            if not parsed or getattr(res, "stub", True):
                return None
            opts = parsed.get("options") or []
            for j, o in enumerate(opts):
                if isinstance(o, dict):
                    o.setdefault("id", "abcd"[j] if j < 4 else str(j))
            ans = parsed.get("answer")
            if not (parsed.get("question") or "").strip() or len(opts) < 2 or not ans:
                return None
            if ans not in [o.get("id") for o in opts]:
                return None
            return {"id": new_id(), "question": parsed["question"], "options": opts,
                    "answer": ans, "explain": parsed.get("explain", ""),
                    "difficulty": difficulty}
        except Exception:  # noqa: BLE001
            log.warning("AI drill question failed; will try the item pool")
            return None

    def _next_question(self, s: Session, sess: DrillSession) -> dict | None:
        """A real question at (or near) the current level — AI first, then the
        authored item pool as a fallback."""
        difficulty = self._LEVELS[sess.level]
        q = self._ai_drill_question(sess.topic, difficulty)
        if q is not None:
            return q
        served = set(sess.served or [])
        order = [sess.level, sess.level - 1, sess.level + 1, sess.level - 2, sess.level + 2]
        for lvl in order:
            if 0 <= lvl <= 2:
                for it in self._drill_pool(s, sess.topic, self._LEVELS[lvl], set()):
                    if it.prompt in served:
                        continue
                    correct = (it.correct or {}).get("option")
                    opts = [{"id": o.get("id"), "text": o.get("text")} for o in (it.options or [])]
                    if correct and len(opts) >= 2:
                        return {"id": it.id, "question": it.prompt, "options": opts,
                                "answer": correct, "explain": "",
                                "difficulty": self._LEVELS[lvl]}
        return None

    def _serve_question(self, sess: DrillSession, q: dict) -> None:
        sess.pending_q = q
        sess.served = list(sess.served or []) + [q["question"]]
        sess.pending_since = _utcnow()

    @staticmethod
    def _drill_public(q: dict) -> dict:
        # question as shown to the learner — answer/explain withheld
        return {"id": q["id"], "prompt": q["question"], "options": q["options"],
                "difficulty": q["difficulty"]}

    def start_drill(self, s: Session, learner_id: str, topic: str | None,
                    target: int = 8) -> dict:
        sess = DrillSession(id=new_id(), learner_id=learner_id, topic=topic,
                            level=1, served=[], correct_count=0, total_count=0,
                            fast_count=0, target=target, status="active")
        s.add(sess)
        s.flush()
        q = self._next_question(s, sess)
        if q is None:
            sess.status = "done"
            s.flush()
            return {"drill_id": sess.id, "item": None,
                    "message": "Couldn't get a question right now — try again.",
                    "progress": {"answered": 0, "target": target}}
        self._serve_question(sess, q)
        s.flush()
        return {"drill_id": sess.id, "topic": topic, "item": self._drill_public(q),
                "level": self._LEVELS[sess.level],
                "progress": {"answered": 0, "target": target}}

    def answer_drill(self, s: Session, learner_id: str, drill_id: str,
                     item_id: str, option: str, elapsed_ms: int) -> dict:
        sess = s.get(DrillSession, drill_id)
        if sess is None:
            raise NotFound("Drill not found", code="drill_not_found")
        if sess.learner_id != learner_id:
            raise Forbidden("Not your drill")
        if sess.status != "active":
            raise Conflict("Drill already finished", code="drill_done")
        pq = sess.pending_q or {}
        if not pq or pq.get("id") != item_id:
            raise Conflict("Unexpected question", code="drill_out_of_sync")
        if not elapsed_ms and sess.pending_since:
            elapsed_ms = int((_utcnow() - _as_utc(sess.pending_since)).total_seconds() * 1000)
        correct_option = pq.get("answer")
        correct = option == correct_option
        fast = 0 < (elapsed_ms or 0) <= self._FAST_MS

        sess.total_count += 1
        if correct:
            sess.correct_count += 1
            if fast:
                sess.fast_count += 1
                sess.level = min(2, sess.level + 1)   # confident & correct → harder
        else:
            sess.level = max(0, sess.level - 1)        # struggling → ease off
        sess.pending_q = {}
        sess.pending_since = None
        s.flush()

        result = {"correct": correct, "correct_option": correct_option,
                  "explain": pq.get("explain", ""),
                  "level": self._LEVELS[sess.level],
                  "progress": {"answered": sess.total_count, "target": sess.target}}
        done = sess.total_count >= sess.target
        nxt = None if done else self._next_question(s, sess)
        if nxt is None:
            done = True
        if done:
            result["done"] = True
            result["summary"] = self._finish_drill(s, sess)
        else:
            self._serve_question(sess, nxt)
            s.flush()
            result["done"] = False
            result["next_item"] = self._drill_public(nxt)
        return result

    def _finish_drill(self, s: Session, sess: DrillSession) -> dict:
        sess.status = "done"
        s.flush()
        acc = round(sess.correct_count * 100.0 / sess.total_count, 1) if sess.total_count else 0.0
        # Feed the twin's reinforcement schedule: a drill is real practice.
        if sess.topic:
            try:
                self.record_activity(s, sess.learner_id, sess.topic, acc,
                                     good=acc >= 60, source="written")
            except Exception:  # noqa: BLE001
                log.warning("could not register drill activity")
        return {"answered": sess.total_count, "correct": sess.correct_count,
                "accuracy": acc, "final_level": self._LEVELS[sess.level],
                "topic": sess.topic}

    @staticmethod
    def _drill_item(it: Item) -> dict:
        return {"id": it.id, "prompt": it.prompt, "options": it.options,
                "difficulty": it.difficulty}

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
