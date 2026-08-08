r"""Seed an AI-Tutor chat session (with a couple messages) for each of the 30 demo
students, so the AI Tutor page shows history. Run auth/seed_demo.py first.

    cd backend/services/ai_tutor
    $env:DB_SCHEMA="ai_tutor"; $env:PYTHONPATH="."
    ..\..\.venv\Scripts\python.exe seed_demo.py
"""
from __future__ import annotations

import json
import os
import sys

os.environ.setdefault("DB_SCHEMA", "ai_tutor")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("../../.env")

import app.models  # noqa: E402,F401
from app.config import TutorConfig  # noqa: E402
from app.models import TutorMessage, TutorSession  # noqa: E402
from lare_common.db import Database  # noqa: E402
from lare_common.security import new_id  # noqa: E402
from sqlalchemy import select  # noqa: E402

ROSTER = json.load(open("../../.run/demo_students.json", encoding="utf-8"))

CHATS = [
    ("Understanding recursion", "Can you explain recursion simply?",
     "Sure! Recursion is when a function calls itself on a smaller input until it "
     "hits a base case. Think of it like Russian dolls — each one contains a "
     "smaller version until the tiniest one (the base case) stops the nesting."),
    ("SQL joins help", "What's the difference between INNER and LEFT JOIN?",
     "INNER JOIN keeps only rows that match in both tables. LEFT JOIN keeps every "
     "row from the left table and fills NULLs where the right table has no match."),
    ("Dynamic programming", "How do I know when to use DP?",
     "Reach for DP when a problem has overlapping subproblems and optimal "
     "substructure — i.e. you keep re-solving the same smaller pieces. Memoise them."),
]


def main():
    cfg = TutorConfig()
    db = Database(cfg.DATABASE_URL, echo=False, schema=cfg.DB_SCHEMA)
    db.create_all()
    ids = [r["user_id"] for r in ROSTER]
    if len(sys.argv) > 1 and sys.argv[1] == "clean":
        with db.session() as s:
            sessions = s.execute(select(TutorSession).where(TutorSession.learner_id.in_(ids))).scalars().all()
            sids = [ts.id for ts in sessions]
            for msg in s.execute(select(TutorMessage).where(TutorMessage.session_id.in_(sids))).scalars().all():
                s.delete(msg)
            for ts in sessions:
                s.delete(ts)
        print("Removed AI Tutor demo data for {} students.".format(len(ids)))
        return
    made = fail = 0
    for r in ROSTER:
        uid, i = r["user_id"], r["idx"]
        try:
            with db.session() as s:
                if s.execute(select(TutorSession).where(TutorSession.learner_id == uid)).scalars().first():
                    continue
                title, q, a = CHATS[i % len(CHATS)]
                sess = TutorSession(id=new_id(), learner_id=uid, title=title)
                s.add(sess)
                s.flush()
                s.add(TutorMessage(id=new_id(), session_id=sess.id, role="user", content=q))
                s.add(TutorMessage(id=new_id(), session_id=sess.id, role="assistant", content=a))
                s.flush()
            made += 1
        except Exception as e:  # noqa: BLE001
            fail += 1
            print("  FAILED {}: {}".format(r["email"], e))
    print("AI Tutor sessions seeded: {} OK, {} failed.".format(made, fail))


if __name__ == "__main__":
    main()
