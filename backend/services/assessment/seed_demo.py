r"""Seed assessment-derived demo data for the 30 students: graded assessments +
attempts/answers (powers Skill Map, Career Readiness, Keep Sharp, Peer Mesh,
Assessments), plus wallets, micro-lessons, an adaptive-drill run, a practice-world
run, review items, and peer-mesh teach sessions. Run auth/seed_demo.py first.

    cd backend/services/assessment
    $env:DB_SCHEMA="assessment"; $env:PYTHONPATH="."
    ..\..\.venv\Scripts\python.exe seed_demo.py
"""
from __future__ import annotations

import json
import os
import sys
from datetime import timedelta

os.environ.setdefault("DB_SCHEMA", "assessment")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("../../.env")

import app.models  # noqa: E402,F401
import app.service as svc_mod  # noqa: E402
from app.config import AssessmentConfig  # noqa: E402
from app.models import (  # noqa: E402
    Answer, Assessment, Attempt, CareerRole, DrillSession, GeneratedLesson, Item,
    PracticeWorld, ReviewItem, TeachSession, WalletCredential, WorldRun,
)
from app.service import AssessmentService, _utcnow  # noqa: E402
from lare_common.db import Database  # noqa: E402
from lare_common.security import new_id  # noqa: E402
from sqlalchemy import or_, select  # noqa: E402

ROSTER = json.load(open("../../.run/demo_students.json", encoding="utf-8"))
NAME = {r["user_id"]: r["name"] for r in ROSTER}

TAG = "[demo]"
# (topic, dimension)
TOPICS = [("Arrays", "aptitude"), ("Strings", "aptitude"), ("SQL", "aptitude"),
          ("DP", "coding"), ("Recursion", "coding"), ("Aptitude", "aptitude")]
CAREERS = [
    ("Backend Developer", "Builds server-side services and databases.",
     [{"name": "SQL", "weight": 2}, {"name": "Arrays", "weight": 1},
      {"name": "Recursion", "weight": 1}, {"name": "DP", "weight": 1}]),
    ("Data Analyst", "Turns data into insight with SQL.",
     [{"name": "SQL", "weight": 3}, {"name": "Aptitude", "weight": 2}]),
    ("Software Engineer", "General DSA problem solver.",
     [{"name": "Arrays", "weight": 2}, {"name": "Strings", "weight": 1},
      {"name": "DP", "weight": 2}, {"name": "Recursion", "weight": 2}]),
]


def score_pct(i, j):
    """Deterministic, varied mastery so students differ per topic."""
    m = (i * 7 + j * 13) % 100
    if (i + j) % 3 == 0:
        return 85 + (m % 15)          # strong
    if (i + j) % 3 == 1:
        return 30 + (m % 25)          # weak
    return 60 + (m % 18)             # developing


def main():
    cfg = AssessmentConfig()
    db = Database(cfg.DATABASE_URL, echo=False, schema=cfg.DB_SCHEMA)
    db.create_all()

    ids = [r["user_id"] for r in ROSTER]
    if len(sys.argv) > 1 and sys.argv[1] == "clean":
        with db.session() as s:
            for att in s.execute(select(Attempt).where(Attempt.learner_id.in_(ids))).scalars().all():
                s.delete(att)  # cascades Answers
            for Model in (ReviewItem, DrillSession, WorldRun, GeneratedLesson, WalletCredential):
                for row in s.execute(select(Model).where(Model.learner_id.in_(ids))).scalars().all():
                    s.delete(row)
            for ts in s.execute(select(TeachSession).where(or_(
                    TeachSession.learner_id.in_(ids), TeachSession.teacher_id.in_(ids)))).scalars().all():
                s.delete(ts)
            for a in s.execute(select(Assessment).where(Assessment.title.like("%" + TAG + "%"))).scalars().all():
                s.delete(a)  # cascades Items
            for c in s.execute(select(CareerRole).where(
                    CareerRole.title.in_([x[0] for x in CAREERS]))).scalars().all():
                s.delete(c)
        print("Removed assessment demo data for {} students.".format(len(ids)))
        return

    # Keep the seed offline/fast: no east-west calls to coding/auth.
    svc_mod._coding_skills = lambda learner_id: {}
    svc = AssessmentService()
    svc._resolve_name = lambda lid: NAME.get(lid, "LARE Learner")

    # --- shared assessments + career roles (one committed session) ---
    with db.session() as s:
        for title, desc, skills in CAREERS:
            if not s.execute(select(CareerRole).where(CareerRole.title == title)).scalars().first():
                s.add(CareerRole(id=new_id(), title=title, description=desc, required_skills=skills))
        for topic, dim in TOPICS:
            title = "{} Test {}".format(topic, TAG)
            if s.execute(select(Assessment).where(Assessment.title == title)).scalars().first() is None:
                a = Assessment(id=new_id(), title=title, year_no=1, type="quiz",
                               dimension=dim, objectives=[topic], passing_pct=60,
                               attempts_allowed=3)
                s.add(a)
                s.flush()
                for k in range(5):
                    s.add(Item(id=new_id(), assessment_id=a.id, item_type="mcq",
                               prompt="{} question {}".format(topic, k + 1),
                               options=[{"id": "a", "text": "correct"}, {"id": "b", "text": "wrong"}],
                               correct={"option": "a"}, weight=1.0, order=k,
                               difficulty=("easy" if k < 2 else "medium" if k < 4 else "hard")))
        s.flush()

    # topic -> assessment id + items (read once)
    with db.session() as s:
        topic_aid, topic_items = {}, {}
        for topic, _dim in TOPICS:
            a = s.execute(select(Assessment).where(
                Assessment.title == "{} Test {}".format(topic, TAG))).scalars().first()
            topic_aid[topic] = a.id
            topic_items[topic] = [it.id for it in s.execute(
                select(Item).where(Item.assessment_id == a.id).order_by(Item.order)).scalars().all()]
        world_ids = [w.id for w in s.execute(select(PracticeWorld)).scalars().all()]
        world_steps = {w.id: len(w.steps or []) for w in s.execute(select(PracticeWorld)).scalars().all()}

    # --- per-student data: OWN session each, so one failure can't abort the rest ---
    ok_count = fail = 0
    for r in ROSTER:
        uid, i = r["user_id"], r["idx"]
        try:
            with db.session() as s:
                if s.execute(select(Attempt).where(Attempt.learner_id == uid)).scalars().first() is None:
                    for j, (topic, _dim) in enumerate(TOPICS):
                        item_ids = topic_items[topic]
                        pct = min(100, score_pct(i, j))
                        n_correct = round(pct / 100.0 * len(item_ids))
                        att = Attempt(id=new_id(), assessment_id=topic_aid[topic], learner_id=uid,
                                      status="graded", score=float(n_correct),
                                      max_score=float(len(item_ids)),
                                      percentage=round(n_correct * 100.0 / len(item_ids), 1),
                                      passed=n_correct * 2 >= len(item_ids), submitted_at=_utcnow())
                        s.add(att)
                        s.flush()
                        for k, iid in enumerate(item_ids):
                            ok = k < n_correct
                            s.add(Answer(id=new_id(), attempt_id=att.id, item_id=iid,
                                         response={"option": "a" if ok else "b"},
                                         auto_score=1.0 if ok else 0.0, final_score=None,
                                         max_score=1.0, needs_grade=False))
                        interval = 7.0 if pct >= 80 else 3.0 if pct >= 55 else 1.0
                        factor = 1.2 if pct < 55 else 0.5 if pct < 80 else 0.2
                        last = _utcnow() - timedelta(days=interval * factor)
                        s.add(ReviewItem(id=new_id(), learner_id=uid, skill=topic, source="written",
                                         interval_days=interval, ease=2.0, review_count=(i % 3),
                                         last_mastery=pct, last_reviewed_at=last,
                                         due_at=last + timedelta(days=interval)))
                    total = 8
                    corr = 4 + (i % 5)
                    s.add(DrillSession(id=new_id(), learner_id=uid, topic=TOPICS[i % len(TOPICS)][0],
                                       level=2 if corr > 6 else 1, served=[], pending_q={},
                                       correct_count=min(corr, total), total_count=total,
                                       fast_count=corr // 2, target=total, status="done"))
                    if world_ids:
                        wid = world_ids[i % len(world_ids)]
                        steps = world_steps.get(wid) or 3
                        wc = min(2 + (i % 2), steps)
                        s.add(WorldRun(id=new_id(), world_id=wid, learner_id=uid, step_index=steps,
                                       answers={}, correct_count=wc,
                                       score=round(wc * 100.0 / steps, 1), status="completed"))
                    for topic in (TOPICS[i % 6][0], TOPICS[(i + 2) % 6][0]):
                        if s.execute(select(GeneratedLesson).where(
                                GeneratedLesson.learner_id == uid,
                                GeneratedLesson.topic == topic)).scalars().first() is None:
                            s.add(GeneratedLesson(id=new_id(), learner_id=uid, topic=topic,
                                                  lesson=svc._fallback_blocks(topic), generated=False))
                    s.flush()
            ok_count += 1
        except Exception as e:  # noqa: BLE001 — isolate per student, keep going
            fail += 1
            print("  FAILED {}: {}".format(r["email"], e))
            continue
        # wallet in its own transaction so a wallet hiccup can't undo the attempts
        try:
            with db.session() as s:
                svc.issue_wallet(s, uid)
        except Exception as e:  # noqa: BLE001
            print("  wallet skip {}: {}".format(r["email"], e))

    # --- peer mesh: a spread of teach requests (own session) ---
    ids = [r["user_id"] for r in ROSTER]
    try:
        with db.session() as s:
            for n in range(0, len(ids) - 1, 2):
                seeker, mentor = ids[n], ids[(n + 1) % len(ids)]
                topic = TOPICS[n % len(TOPICS)][0]
                if s.execute(select(TeachSession).where(
                        TeachSession.learner_id == seeker, TeachSession.teacher_id == mentor,
                        TeachSession.topic == topic)).scalars().first() is None:
                    s.add(TeachSession(id=new_id(), topic=topic, teacher_id=mentor,
                                       learner_id=seeker, requested_by=seeker,
                                       status="accepted" if n % 3 else "requested"))
    except Exception as e:  # noqa: BLE001
        print("  peer-mesh seed failed:", e)

    print("Assessment demo seeded: {} students OK, {} failed.".format(ok_count, fail))


if __name__ == "__main__":
    main()
