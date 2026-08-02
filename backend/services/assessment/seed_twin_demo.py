"""Seed one graded demo assessment for a learner and print their Cognitive Twin
skill profile — a fast way to verify the LMS Twin before real assessment data
exists.

Run from the assessment service directory:

    cd ~/larelms/Lare-LMS/backend/services/assessment
    DB_SCHEMA=assessment PYTHONPATH=. \
      ~/larelms/Lare-LMS/backend/venv/bin/python seed_twin_demo.py [learner_id]

Pass a real student's user id as [learner_id] to then view it in the UI
(log in as that student -> My Skill Map). With no argument it uses a throwaway
demo id so no real learner is affected.

Cleanup (removes the demo rows) — pass "clean" as the second arg:
    ... seed_twin_demo.py <learner_id> clean
"""
from __future__ import annotations

import json
import os
import sys

os.environ.setdefault("DB_SCHEMA", "assessment")

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import app.models  # noqa: E402,F401  (register models on Base.metadata)
from app.config import AssessmentConfig  # noqa: E402
from app.models import Answer, Assessment, Attempt, Item  # noqa: E402
from app.service import AssessmentService  # noqa: E402
from lare_common.db import Database  # noqa: E402
from lare_common.security import new_id  # noqa: E402
from sqlalchemy import select  # noqa: E402

learner_id = sys.argv[1] if len(sys.argv) > 1 else "twin-demo-learner"
do_clean = len(sys.argv) > 2 and sys.argv[2] == "clean"

cfg = AssessmentConfig()
db = Database(cfg.DATABASE_URL, echo=False, schema=cfg.DB_SCHEMA)
db.create_all()
svc = AssessmentService()

TITLE = "Twin Demo Quiz"
# (topic, is_correct) — 4 correct / 2 wrong across three learning objectives.
SPEC = [("Arrays", True), ("Arrays", True), ("Loops", True),
        ("Loops", False), ("SQL", True), ("SQL", False)]

if do_clean:
    with db.session() as s:
        for a in s.execute(select(Assessment).where(Assessment.title == TITLE)).scalars().all():
            for att in s.execute(select(Attempt).where(Attempt.assessment_id == a.id)).scalars().all():
                for ans in s.execute(select(Answer).where(Answer.attempt_id == att.id)).scalars().all():
                    s.delete(ans)
                s.delete(att)
            for it in s.execute(select(Item).where(Item.assessment_id == a.id)).scalars().all():
                s.delete(it)
            s.delete(a)
    print("Removed the Twin Demo Quiz and its attempts/answers.")
    sys.exit(0)

with db.session() as s:
    a = Assessment(id=new_id(), title=TITLE, year_no=1, type="quiz",
                   dimension="aptitude", objectives=["Arrays", "Loops", "SQL"],
                   passing_pct=60)
    s.add(a)
    s.flush()
    items = []
    for i, (topic, _) in enumerate(SPEC):
        it = Item(id=new_id(), assessment_id=a.id, item_type="mcq",
                  prompt=f"{topic} question {i + 1}",
                  options=[{"id": "a", "text": "correct"}, {"id": "b", "text": "wrong"}],
                  correct={"option": "a"}, weight=1.0, order=i)
        s.add(it)
        items.append(it)
    s.flush()

    correct_n = sum(1 for _, c in SPEC if c)
    att = Attempt(id=new_id(), assessment_id=a.id, learner_id=learner_id,
                  status="graded", score=float(correct_n), max_score=float(len(SPEC)),
                  percentage=round(correct_n * 100.0 / len(SPEC), 1), passed=True)
    s.add(att)
    s.flush()
    for it, (_, is_correct) in zip(items, SPEC):
        s.add(Answer(id=new_id(), attempt_id=att.id, item_id=it.id,
                     response={"option": "a" if is_correct else "b"},
                     auto_score=1.0 if is_correct else 0.0, final_score=None,
                     max_score=1.0, needs_grade=False))
    s.flush()

    profile = svc.skill_profile(s, learner_id)

print(json.dumps(profile, indent=2))
print(f"\nSeeded a graded demo assessment for learner_id = {learner_id!r}.")
print("Expected: overall ~66.7% · Arrays strong (100%) · Loops & SQL weak (50%).")
print("If that id is a real student, log in as them -> My Skill Map to see it in the UI.")
print("Remove the demo data later with:  ... seed_twin_demo.py <learner_id> clean")
