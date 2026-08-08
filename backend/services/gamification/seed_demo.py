r"""Seed gamification demo data for the 30 students: XP, level, and badges, so the
Achievements page is populated. Run auth/seed_demo.py first.

    cd backend/services/gamification
    $env:DB_SCHEMA="gamification"; $env:PYTHONPATH="."
    ..\..\.venv\Scripts\python.exe seed_demo.py
"""
from __future__ import annotations

import json
import os
import sys

os.environ.setdefault("DB_SCHEMA", "gamification")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("../../.env")

import app.models  # noqa: E402,F401
from app.config import GamificationConfig  # noqa: E402
from app.models import Badge, LearnerBadge, LevelState, XPEntry  # noqa: E402
from lare_common.db import Database  # noqa: E402
from lare_common.security import new_id  # noqa: E402
from sqlalchemy import select  # noqa: E402

ROSTER = json.load(open("../../.run/demo_students.json", encoding="utf-8"))

BADGES = [
    ("first_steps", "First Steps", "Completed your first assessment", "footprints"),
    ("quiz_ace", "Quiz Ace", "Scored 90%+ on a test", "trophy"),
    ("coder", "Code Warrior", "Solved 5 coding problems", "code"),
    ("streak_7", "7-Day Streak", "Practised 7 days in a row", "flame"),
    ("verified", "Verified Skill", "Passed a skill viva", "shield-check"),
]
XP_ACTIONS = [("assessment_passed", 120), ("problem_solved", 80),
              ("lesson_completed", 40), ("streak_bonus", 60)]


def main():
    cfg = GamificationConfig()
    db = Database(cfg.DATABASE_URL, echo=False, schema=cfg.DB_SCHEMA)
    db.create_all()
    ids = [r["user_id"] for r in ROSTER]
    if len(sys.argv) > 1 and sys.argv[1] == "clean":
        with db.session() as s:
            for Model in (XPEntry, LevelState, LearnerBadge):
                for row in s.execute(select(Model).where(Model.learner_id.in_(ids))).scalars().all():
                    s.delete(row)
        print("Removed gamification demo data for {} students.".format(len(ids)))
        return
    with db.session() as s:
        for code, name, desc, icon in BADGES:
            if not s.execute(select(Badge).where(Badge.code == code)).scalars().first():
                s.add(Badge(id=new_id(), code=code, name=name, description=desc, icon=icon))
        s.flush()

    made = fail = 0
    for r in ROSTER:
        uid, i = r["user_id"], r["idx"]
        try:
            with db.session() as s:
                if s.execute(select(LevelState).where(LevelState.learner_id == uid)).scalars().first():
                    continue
                total = 0
                for k, (action, pts) in enumerate(XP_ACTIONS):
                    for _ in range(1 + ((i + k) % 4)):
                        s.add(XPEntry(id=new_id(), learner_id=uid, action=action, points=pts))
                        total += pts
                s.add(LevelState(learner_id=uid, total_xp=total, level=max(1, total // 300),
                                 display_name=r["name"]))
                for bi in range((i % 3) + 2):
                    code = BADGES[(i + bi) % len(BADGES)][0]
                    if s.execute(select(LearnerBadge).where(
                            LearnerBadge.learner_id == uid,
                            LearnerBadge.badge_code == code)).scalars().first() is None:
                        s.add(LearnerBadge(id=new_id(), learner_id=uid, badge_code=code))
                s.flush()
            made += 1
        except Exception as e:  # noqa: BLE001
            fail += 1
            print("  FAILED {}: {}".format(r["email"], e))
    print("Gamification demo seeded: {} OK, {} failed.".format(made, fail))


if __name__ == "__main__":
    main()
