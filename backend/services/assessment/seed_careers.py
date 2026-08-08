"""Seed the LARE Learn career-role catalog for the Skills-to-Opportunity map.
Skill names should line up with your assessment objectives / practice skills
(e.g. Arrays, Strings, SQL, DP, Recursion) and coding languages (Python, ...),
so a learner's twin can be matched against them.

    cd ~/larelms/Lare-LMS/backend/services/assessment
    DB_SCHEMA=assessment PYTHONPATH=. <venv>/bin/python seed_careers.py
    # remove:  ... seed_careers.py clean
"""
from __future__ import annotations

import os
import sys

os.environ.setdefault("DB_SCHEMA", "assessment")

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import app.models  # noqa: E402,F401
from app.config import AssessmentConfig  # noqa: E402
from app.models import CareerRole  # noqa: E402
from lare_common.db import Database  # noqa: E402
from lare_common.security import new_id  # noqa: E402
from sqlalchemy import select  # noqa: E402


def S(name, weight=1.0):
    return {"name": name, "weight": weight}


CAREERS = [
    ("Backend Developer",
     "Builds server-side services, APIs and databases.",
     [S("Arrays", 1), S("Strings", 1), S("SQL", 2), S("Recursion", 1),
      S("Python", 2), S("DP", 1)]),
    ("Frontend Developer",
     "Builds user interfaces and client-side logic.",
     [S("Arrays", 1), S("Strings", 2), S("JavaScript", 2), S("Aptitude", 1)]),
    ("Data Analyst",
     "Turns data into insight with SQL and statistics.",
     [S("SQL", 3), S("Aptitude", 2), S("Math", 2), S("Python", 1)]),
    ("Software Engineer (SDE)",
     "General problem-solver across data structures and algorithms.",
     [S("Arrays", 2), S("Strings", 1), S("Recursion", 2), S("DP", 2),
      S("Bit Manipulation", 1), S("Python", 1)]),
    ("QA / Test Engineer",
     "Ensures quality through testing and edge-case thinking.",
     [S("Arrays", 1), S("Strings", 1), S("Aptitude", 2), S("SQL", 1)]),
]

TAG_TITLES = {c[0] for c in CAREERS}


def main():
    cfg = AssessmentConfig()
    db = Database(cfg.DATABASE_URL, echo=False, schema=cfg.DB_SCHEMA)
    db.create_all()

    if len(sys.argv) > 1 and sys.argv[1] == "clean":
        with db.session() as s:
            rows = s.execute(select(CareerRole).where(
                CareerRole.title.in_(TAG_TITLES))).scalars().all()
            for c in rows:
                s.delete(c)
        print("Removed {} seeded career roles.".format(len(rows)))
        return

    created = updated = 0
    with db.session() as s:
        for title, desc, skills in CAREERS:
            c = s.execute(select(CareerRole).where(
                CareerRole.title == title)).scalars().first()
            if c is None:
                c = CareerRole(id=new_id(), title=title)
                s.add(c)
                created += 1
            else:
                updated += 1
            c.description = desc
            c.required_skills = skills
        s.flush()
    print("Career catalog seeded: {} created, {} updated ({} roles).".format(
        created, updated, len(CAREERS)))
    print("Learners see readiness in LARE Learn -> Career Readiness.")


if __name__ == "__main__":
    main()
