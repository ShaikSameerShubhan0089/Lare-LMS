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

TAG = "[twin-demo]"
# Topics live at the ASSESSMENT level (objectives), so each topic is its own
# assessment. (title, topic, [correct?, ...]) — Arrays strong, Loops/SQL weak.
DEMO = [
    (f"Arrays Quiz {TAG}", "Arrays", [True, True]),    # 2/2 = 100% strong
    (f"Loops Quiz {TAG}", "Loops", [True, False]),      # 1/2 = 50%  weak
    (f"SQL Quiz {TAG}", "SQL", [True, False]),          # 1/2 = 50%  weak
]

if do_clean:
    from sqlalchemy import or_
    with db.session() as s:
        match = or_(Assessment.title.like(f"%{TAG}%"), Assessment.title == "Twin Demo Quiz")
        for a in s.execute(select(Assessment).where(match)).scalars().all():
            for att in s.execute(select(Attempt).where(Attempt.assessment_id == a.id)).scalars().all():
                for ans in s.execute(select(Answer).where(Answer.attempt_id == att.id)).scalars().all():
                    s.delete(ans)
                s.delete(att)
            for it in s.execute(select(Item).where(Item.assessment_id == a.id)).scalars().all():
                s.delete(it)
            s.delete(a)
    print("Removed the twin-demo assessments and their attempts/answers.")
    sys.exit(0)

with db.session() as s:
    for title, topic, results in DEMO:
        a = Assessment(id=new_id(), title=title, year_no=1, type="quiz",
                       dimension="aptitude", objectives=[topic], passing_pct=60)
        s.add(a)
        s.flush()
        items = []
        for i, _ in enumerate(results):
            it = Item(id=new_id(), assessment_id=a.id, item_type="mcq",
                      prompt=f"{topic} question {i + 1}",
                      options=[{"id": "a", "text": "correct"}, {"id": "b", "text": "wrong"}],
                      correct={"option": "a"}, weight=1.0, order=i)
            s.add(it)
            items.append(it)
        s.flush()
        n_correct = sum(1 for c in results if c)
        att = Attempt(id=new_id(), assessment_id=a.id, learner_id=learner_id,
                      status="graded", score=float(n_correct), max_score=float(len(results)),
                      percentage=round(n_correct * 100.0 / len(results), 1), passed=n_correct * 2 >= len(results))
        s.add(att)
        s.flush()
        for it, is_correct in zip(items, results):
            s.add(Answer(id=new_id(), attempt_id=att.id, item_id=it.id,
                         response={"option": "a" if is_correct else "b"},
                         auto_score=1.0 if is_correct else 0.0, final_score=None,
                         max_score=1.0, needs_grade=False))
        s.flush()

    profile = svc.skill_profile(s, learner_id)

print(json.dumps(profile, indent=2))
print(f"\nSeeded 3 graded demo assessments for learner_id = {learner_id!r}.")
print("Expected: overall ~66.7% · Arrays STRONG (100%) · Loops & SQL WEAK (50%).")
print("If that id is a real student, log in as them -> My Skill Map to see it in the UI.")
print("Remove the demo data later with:  ... seed_twin_demo.py <learner_id> clean")
