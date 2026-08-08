r"""Seed Learner roster records for the 30 demo students (admin roster views).
Run auth/seed_demo.py first. Idempotent (matches on user_id).

    cd backend/services/learner
    $env:DB_SCHEMA="learner"; $env:PYTHONPATH="."
    ..\..\.venv\Scripts\python.exe seed_demo.py
"""
from __future__ import annotations

import json
import os
import sys

os.environ.setdefault("DB_SCHEMA", "learner")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("../../.env")

import app.models  # noqa: E402,F401
from app.config import LearnerConfig  # noqa: E402
from app.models import Enrollment, Learner  # noqa: E402
from lare_common.db import Database  # noqa: E402
from lare_common.security import new_id  # noqa: E402
from sqlalchemy import select  # noqa: E402

ROSTER = json.load(open("../../.run/demo_students.json", encoding="utf-8"))


def main():
    cfg = LearnerConfig()
    db = Database(cfg.DATABASE_URL, echo=False, schema=cfg.DB_SCHEMA)
    db.create_all()
    ids = [r["user_id"] for r in ROSTER]
    if len(sys.argv) > 1 and sys.argv[1] == "clean":
        with db.session() as s:
            rows = s.execute(select(Learner).where(Learner.user_id.in_(ids))).scalars().all()
            lids = [lr.id for lr in rows]
            for e in s.execute(select(Enrollment).where(Enrollment.learner_id.in_(lids))).scalars().all():
                s.delete(e)
            for lr in rows:
                s.delete(lr)
        print("Removed {} demo learner records.".format(len(rows)))
        return
    created = 0
    with db.session() as s:
        for r in ROSTER:
            lr = s.execute(select(Learner).where(Learner.user_id == r["user_id"])).scalars().first()
            if lr is None:
                lr = Learner(id=new_id(), user_id=r["user_id"], college_id=r["college_id"],
                             cohort_id=r["cohort_id"], roll_no=r["roll"], full_name=r["name"],
                             email=r["email"], cgpa=r["cgpa"], status="active",
                             verified=True, year_no=r["year_no"])
                s.add(lr)
                s.flush()
                created += 1
                s.add(Enrollment(id=new_id(), learner_id=lr.id, year_no=r["year_no"],
                                 status="active"))
                s.flush()
    print("Learner roster seeded: {} new ({} total in roster).".format(created, len(ROSTER)))


if __name__ == "__main__":
    main()
