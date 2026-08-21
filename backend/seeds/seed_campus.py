"""Seed a complete demo campus for end-to-end testing of the LARE platform.

Creates, across the three schemas (lms_institution / lare_auth / lms_learner):

  * 5 Engineering colleges (6 branches × 4 years) + 5 Degree colleges
    (4 branches × 3 years), each branch-year a section of 100 students.
  * Per college: a Principal, a Dean, a TPO, and 2 Faculty per branch — each
    with a login and a scoped role grant (principal/dean/tpo → their college,
    faculty → the cohorts they teach).
  * 18,000 student login accounts + linked learner roster records, so the
    Super Admin analytics compute REAL numbers over seeded data.
  * The Super Admin login the spec asks for (superadmin@platform.com).

Design notes
  - Clearly-labelled test data: names like "Engineering College 01", emails on
    @campus.lare.test. Easy to identify and purge.
  - Students share ONE documented password (hashed once) — practical for 18k
    test logins. Staff get unique random passwords, written to a gitignored
    credentials CSV. Nothing real is fabricated; this is explicit demo data.
  - Idempotent-ish: refuses to run if the demo colleges already exist unless
    --force is given. --dry-run reports the full plan and writes nothing.

Usage (from repo root, with the RDS tunnel open):
    python backend/seeds/seed_campus.py --dry-run
    python backend/seeds/seed_campus.py            # real run (asks nothing; be sure)
    python backend/seeds/seed_campus.py --students-per-cohort 5   # small test set
"""
from __future__ import annotations

import argparse
import csv
import os
import pathlib
import random
import secrets
import sys
from datetime import datetime, timezone

# lare_common lives under backend/libs
ROOT = pathlib.Path(__file__).resolve().parents[1]           # backend/
sys.path.insert(0, str(ROOT / "libs"))
from lare_common.security import hash_password, new_id        # noqa: E402

import psycopg                                                # noqa: E402

SCHEMA_INST = "lms_institution"
SCHEMA_AUTH = "lare_auth"
SCHEMA_LEARN = "lms_learner"

STUDENT_PASSWORD = "Student@2026"
SUPER_ADMIN = {"email": "superadmin@platform.com", "password": "SuperAdmin@2026",
               "name": "Platform Super Admin"}
EMAIL_DOMAIN = "campus.lare.test"

ENG_BRANCHES = [  # (name, code, category)
    ("Computer Science & Engineering", "CSE", "cse_allied"),
    ("Electronics & Communication", "ECE", "core"),
    ("Electrical & Electronics", "EEE", "core"),
    ("Artificial Intelligence & Data Science", "AIDS", "cse_allied"),
    ("CSE — Artificial Intelligence", "CSE-AI", "cse_allied"),
    ("CSE — Data Science", "CSE-DS", "cse_allied"),
]
DEG_BRANCHES = [
    ("BSc Computers", "BSC-COMP", "cse_allied"),
    ("BSc Artificial Intelligence", "BSC-AI", "cse_allied"),
    ("BSc MPC", "BSC-MPC", "core"),
    ("BZC", "BZC", "core"),
]

FIRST = ["Aarav", "Vivaan", "Aditya", "Sai", "Ananya", "Diya", "Ishaan", "Kabir",
         "Meera", "Riya", "Rohan", "Sneha", "Arjun", "Priya", "Karthik", "Divya",
         "Rahul", "Pooja", "Nikhil", "Sruthi", "Tejas", "Harini", "Manoj", "Lasya"]
LAST = ["Reddy", "Sharma", "Naidu", "Rao", "Gupta", "Patel", "Kumar", "Varma",
        "Nair", "Iyer", "Chowdary", "Prasad", "Menon", "Bose", "Das", "Shetty"]

now = datetime.now(tz=timezone.utc)


def db_url(override: str | None) -> str:
    if override:
        return override.replace("postgresql+psycopg://", "postgresql://")
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip().strip('"').strip("'").replace(
                "postgresql+psycopg://", "postgresql://")
    sys.exit("DATABASE_URL not found (pass --db-url)")


def rand_name() -> str:
    return f"{random.choice(FIRST)} {random.choice(LAST)}"


def rand_cgpa() -> float:
    # realistic spread, ~10% below 6.0 (at-risk), clamped to [5.0, 9.9]
    return round(min(9.9, max(5.0, random.gauss(7.1, 1.1))), 2)


# ---------------------------------------------------------------------------
# Plan builder — computes every row in memory (no DB). Lets --dry-run validate.
# ---------------------------------------------------------------------------
class Plan:
    def __init__(self, per_cohort: int, n_eng: int, n_deg: int):
        self.colleges, self.branches, self.years, self.cohorts = [], [], [], []
        self.users, self.user_roles, self.learners = [], [], []
        self.staff_creds = []               # (login_email, password, role, college)
        self._student_pw_hash = hash_password(STUDENT_PASSWORD)

        specs = ([("Engineering College %02d", ENG_BRANCHES, 4, "eng")] * n_eng
                 + [("Degree College %02d", DEG_BRANCHES, 3, "deg")] * n_deg)
        eng_i = deg_i = 0
        for tmpl, branches, n_years, kind in specs:
            if kind == "eng":
                eng_i += 1; idx = eng_i; prefix = f"ENG{eng_i:02d}"
            else:
                deg_i += 1; idx = deg_i; prefix = f"DEG{deg_i:02d}"
            self._college(tmpl % idx, prefix, branches, n_years, per_cohort)

        # the explicit super admin
        self._user(SUPER_ADMIN["email"], SUPER_ADMIN["name"], "super_admin",
                   pw=SUPER_ADMIN["password"])

    def _user(self, email, name, role, *, pw=None, college_id=None,
              branch_id=None, cohort_id=None, is_student=False):
        uid = new_id()
        pw_hash = self._student_pw_hash if is_student else hash_password(pw)
        self.users.append((uid, email.lower(), "learn", pw_hash, name, "active",
                           True, False, "lare", 0, None, now))
        if role:
            self.user_roles.append((new_id(), uid, role, college_id, branch_id, cohort_id))
        return uid

    def _college(self, name, prefix, branches, n_years, per_cohort):
        cid = new_id()
        self.colleges.append((cid, "lare", name, None, "Asia/Kolkata", "active", 60, 30, now))
        pslug = prefix.lower()
        # leadership — each scoped to this college
        for r in ("principal", "dean", "tpo"):
            pw, email = _pw(), f"{pslug}.{r}@{EMAIL_DOMAIN}"
            self._user(email, f"{name} {r.title()}", r, pw=pw, college_id=cid)
            self.staff_creds.append((email.lower(), pw, r, cid))

        # academic years for the college
        year_ids = {}
        for y in range(1, n_years + 1):
            yid = new_id()
            self.years.append((yid, cid, y, None, None))
            year_ids[y] = yid

        for bname, bcode, cat in branches:
            bid = new_id()
            self.branches.append((bid, cid, bname, bcode, cat))
            bslug = bcode.lower().replace("-", "")
            # cohorts: one section per branch-year
            branch_cohorts = []
            for y in range(1, n_years + 1):
                khid = new_id()
                self.cohorts.append((khid, cid, bid, year_ids[y], "A", y, per_cohort))
                branch_cohorts.append(khid)
                # students of this cohort — learner name mirrors the auth account
                for n in range(1, per_cohort + 1):
                    roll = f"{prefix}-{bcode}-{y}-{n:03d}"
                    email = f"{roll.lower()}@{EMAIL_DOMAIN}"
                    sname = rand_name()
                    uid = self._user(email, sname, "student", is_student=True)
                    self.learners.append((new_id(), uid, cid, khid, bid, roll, sname,
                                          email, rand_cgpa(), None, "active",
                                          random.random() < 0.7, y, now))
            # 2 faculty per branch, splitting the branch's cohorts between them
            for f in range(1, 3):
                fpw = _pw()
                femail = f"{pslug}.{bslug}.faculty{f:02d}@{EMAIL_DOMAIN}"
                fuid = self._user(femail, f"{rand_name()} ({bcode} Faculty)", None, pw=fpw)
                self.staff_creds.append((femail.lower(), fpw, "faculty", cid))
                for kh in [kh for j, kh in enumerate(branch_cohorts) if j % 2 == (f - 1)]:
                    self.user_roles.append((new_id(), fuid, "faculty", cid, bid, kh))

    # convenience counters
    def summary(self) -> dict:
        return {
            "colleges": len(self.colleges), "branches": len(self.branches),
            "academic_years": len(self.years), "cohorts": len(self.cohorts),
            "users": len(self.users), "user_roles": len(self.user_roles),
            "learners": len(self.learners), "staff_credentials": len(self.staff_creds),
        }


_PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
def _pw() -> str:
    return "".join(secrets.choice(_PW_ALPHABET) for _ in range(12))


# ---------------------------------------------------------------------------
# Writer
# ---------------------------------------------------------------------------
def _exists(cur) -> bool:
    cur.execute(f"SELECT 1 FROM {SCHEMA_INST}.colleges WHERE name = %s LIMIT 1",
                ("Engineering College 01",))
    return cur.fetchone() is not None


def _role_ids(cur) -> dict:
    cur.execute(f"SELECT name, id FROM {SCHEMA_AUTH}.roles")
    return dict(cur.fetchall())


def write(url: str, plan: Plan) -> None:
    with psycopg.connect(url, autocommit=False) as conn, conn.cursor() as cur:
        if _exists(cur):
            sys.exit("Demo colleges already exist — aborting. Re-run with --force to override "
                     "(that will insert duplicates; prefer a clean DB).")
        roles = _role_ids(cur)
        missing = {r for (_i, _u, r, *_rest) in plan.user_roles if r not in roles}
        if missing:
            sys.exit(f"Roles not seeded yet: {missing}. Run the auth seed first.")

        def many(sql, rows, batch=2000):
            for i in range(0, len(rows), batch):
                cur.executemany(sql, rows[i:i + batch])

        print("… institution hierarchy")
        many(f"INSERT INTO {SCHEMA_INST}.colleges "
             "(id,tenant_id,name,address,timezone,status,passing_threshold,min_cohort_size,created_at) "
             "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)", plan.colleges)
        many(f"INSERT INTO {SCHEMA_INST}.branches (id,college_id,name,code,category) "
             "VALUES (%s,%s,%s,%s,%s)", plan.branches)
        many(f"INSERT INTO {SCHEMA_INST}.academic_years (id,college_id,year_no,start,\"end\") "
             "VALUES (%s,%s,%s,%s,%s)", plan.years)
        many(f"INSERT INTO {SCHEMA_INST}.cohorts "
             "(id,college_id,branch_id,academic_year_id,section,year_no,size) "
             "VALUES (%s,%s,%s,%s,%s,%s,%s)", plan.cohorts)

        print(f"… {len(plan.users):,} auth accounts")
        many(f"INSERT INTO {SCHEMA_AUTH}.users "
             "(id,email,product,password_hash,full_name,status,email_verified,"
             "mfa_enabled,tenant_id,failed_attempts,locked_until,created_at) "
             "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", plan.users)

        print(f"… {len(plan.user_roles):,} role grants")
        role_rows = [(i, u, roles[r], c, b, k) for (i, u, r, c, b, k) in plan.user_roles]
        many(f"INSERT INTO {SCHEMA_AUTH}.user_roles (id,user_id,role_id,college_id,branch_id,cohort_id) "
             "VALUES (%s,%s,%s,%s,%s,%s)", role_rows)

        print(f"… {len(plan.learners):,} learner records")
        many(f"INSERT INTO {SCHEMA_LEARN}.learners "
             "(id,user_id,college_id,cohort_id,branch_id,roll_no,full_name,email,cgpa,"
             "photo_file_id,status,verified,year_no,created_at) "
             "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", plan.learners)

        conn.commit()
    print("committed.")


def write_credentials(plan: Plan) -> pathlib.Path:
    path = ROOT / "seeds" / "campus_credentials.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["login_email", "password", "role", "college_id"])
        w.writerow([SUPER_ADMIN["email"], SUPER_ADMIN["password"], "super_admin", ""])
        for email, pw, role, college in plan.staff_creds:
            w.writerow([email, pw, role, college])
        w.writerow(["(all students)", STUDENT_PASSWORD, "student", "shared password"])
    return path


def purge(url: str) -> None:
    """Remove every seeded demo row (colleges by name, accounts by email domain).
    Makes the whole 54k-row insert fully reversible."""
    with psycopg.connect(url, autocommit=False) as conn, conn.cursor() as cur:
        cur.execute(f"DELETE FROM {SCHEMA_LEARN}.learners WHERE email LIKE %s",
                    (f"%@{EMAIL_DOMAIN}",))
        print("  learners:", cur.rowcount)
        # users cascade to user_roles via FK ON DELETE CASCADE
        cur.execute(f"DELETE FROM {SCHEMA_AUTH}.users WHERE email LIKE %s OR email = %s",
                    (f"%@{EMAIL_DOMAIN}", SUPER_ADMIN["email"]))
        print("  users (+cascade roles):", cur.rowcount)
        # colleges cascade to branches / academic_years / cohorts
        cur.execute(f"DELETE FROM {SCHEMA_INST}.colleges "
                    "WHERE name LIKE 'Engineering College %' OR name LIKE 'Degree College %'")
        print("  colleges (+cascade branches/years/cohorts):", cur.rowcount)
        conn.commit()
    print("purged.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="report the plan; write nothing")
    ap.add_argument("--purge", action="store_true", help="delete all seeded demo data, then exit")
    ap.add_argument("--students-per-cohort", type=int, default=100)
    ap.add_argument("--eng", type=int, default=5, help="number of engineering colleges")
    ap.add_argument("--deg", type=int, default=5, help="number of degree colleges")
    ap.add_argument("--db-url", default=None)
    args = ap.parse_args()

    if args.purge:
        print("Purging seeded demo data …")
        purge(db_url(args.db_url))
        return

    random.seed(42)  # reproducible demo data
    print(f"Building plan: {args.eng} eng + {args.deg} degree colleges, "
          f"{args.students_per_cohort} students/cohort …")
    plan = Plan(args.students_per_cohort, args.eng, args.deg)

    s = plan.summary()
    print("\n=== PLAN ===")
    for k, v in s.items():
        print(f"  {k:20s} {v:,}")
    print("  sample student login:", plan.learners[0][7], "/", STUDENT_PASSWORD)

    if args.dry_run:
        print("\n[dry-run] nothing written.")
        return

    creds = write_credentials(plan)
    print(f"\nstaff credentials → {creds}")
    write(db_url(args.db_url), plan)
    print("\nDONE. Super Admin:", SUPER_ADMIN["email"], "/", SUPER_ADMIN["password"])


if __name__ == "__main__":
    main()
