"""Add columns that `init-db` (create_all) can't add to existing tables.
Idempotent + dialect-aware (SQLite and Postgres): checks the live schema and
only adds what's missing. Run with the same env run-all.sh uses.

    cd ~/larelms/Lare-LMS/backend/services/assessment
    DB_SCHEMA=assessment PYTHONPATH=. <venv>/bin/python migrate_cols.py
    # (SQLite local: DB_SCHEMA="" DATABASE_URL=sqlite:///assessment.sqlite3 ... )
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

import app.models  # noqa: E402,F401
from app.config import AssessmentConfig  # noqa: E402
from lare_common.db import Database  # noqa: E402
from sqlalchemy import inspect, text  # noqa: E402

# (table, column, DDL type + default)
COLUMNS = [
    ("assessment_items", "difficulty", "VARCHAR(8) DEFAULT 'medium'"),
    ("assessments", "proctored", "BOOLEAN DEFAULT FALSE"),
    ("assessments", "shuffle", "BOOLEAN DEFAULT FALSE"),
    ("drill_sessions", "pending_q", "JSON DEFAULT '{}'"),
]


def main():
    cfg = AssessmentConfig()
    db = Database(cfg.DATABASE_URL, echo=False, schema=cfg.DB_SCHEMA)
    db.create_all()  # ensure all new tables exist too
    schema = cfg.DB_SCHEMA or None
    insp = inspect(db.engine)
    added = 0
    with db.engine.begin() as conn:
        for table, col, ddl in COLUMNS:
            try:
                cols = {c["name"] for c in insp.get_columns(table, schema=schema)}
            except Exception:
                print("  skip {} (table missing)".format(table))
                continue
            if col in cols:
                continue
            qualified = '{}.{}'.format(schema, table) if schema else table
            conn.execute(text('ALTER TABLE {} ADD COLUMN {} {}'.format(qualified, col, ddl)))
            print("  + {}.{}".format(table, col))
            added += 1
    print("Column migration done ({} added).".format(added))


if __name__ == "__main__":
    main()
