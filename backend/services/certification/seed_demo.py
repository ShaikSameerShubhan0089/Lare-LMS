r"""Seed a Year-1 certificate for each of the 30 demo students, so the
Certificates page is populated (each with a public verify id). Run
auth/seed_demo.py first.

    cd backend/services/certification
    $env:DB_SCHEMA="certification"; $env:PYTHONPATH="."
    ..\..\.venv\Scripts\python.exe seed_demo.py
"""
from __future__ import annotations

import json
import os
import sys

os.environ.setdefault("DB_SCHEMA", "certification")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("../../.env")

import app.models  # noqa: E402,F401
from app.config import CertificationConfig  # noqa: E402
from app.models import Certificate  # noqa: E402
from lare_common.db import Database  # noqa: E402
from lare_common.security import new_id, random_token  # noqa: E402
from sqlalchemy import select  # noqa: E402

ROSTER = json.load(open("../../.run/demo_students.json", encoding="utf-8"))


def main():
    cfg = CertificationConfig()
    db = Database(cfg.DATABASE_URL, echo=False, schema=cfg.DB_SCHEMA)
    db.create_all()
    ids = [r["user_id"] for r in ROSTER]
    if len(sys.argv) > 1 and sys.argv[1] == "clean":
        with db.session() as s:
            rows = s.execute(select(Certificate).where(Certificate.learner_id.in_(ids))).scalars().all()
            for c in rows:
                s.delete(c)
        print("Removed {} demo certificates.".format(len(rows)))
        return
    made = fixed = fail = 0
    for r in ROSTER:
        uid, i = r["user_id"], r["idx"]
        # readable, unique public code, e.g. LARE-VER-4821
        vid = "LARE-VER-{:04d}".format(1000 + (i * 313) % 9000)
        try:
            with db.session() as s:
                c = s.execute(select(Certificate).where(
                    Certificate.learner_id == uid, Certificate.year_no == 1)).scalars().first()
                if c is None:
                    s.add(Certificate(id=new_id(), learner_id=uid, year_no=1, template_id=None,
                                      cert_no="LARE-Y1-{:04d}".format(i),
                                      cert_name="Year 1 - Foundations of Engineering",
                                      verify_id=vid, status="issued",
                                      holder_name=r["name"], ppo_tag=(i % 5 == 0)))
                    made += 1
                elif not (c.verify_id or "").startswith("LARE-VER-"):
                    c.verify_id = vid  # upgrade an old random verify id in place
                    fixed += 1
        except Exception as e:  # noqa: BLE001
            fail += 1
            print("  FAILED {}: {}".format(r["email"], e))
    print("Certificates seeded: {} new, {} verify-ids upgraded, {} failed.".format(made, fixed, fail))


if __name__ == "__main__":
    main()
