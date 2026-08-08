"""Seed the Embodied Practice Worlds — browser workplace simulations that score
competence from realistic on-the-job decisions and feed the twin.

    cd ~/larelms/Lare-LMS/backend/services/assessment
    DB_SCHEMA=assessment PYTHONPATH=. <venv>/bin/python seed_worlds.py
    # remove:  ... seed_worlds.py clean
"""
from __future__ import annotations

import os
import sys

os.environ.setdefault("DB_SCHEMA", "assessment")

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import app.models  # noqa: E402,F401
from app.config import AssessmentConfig  # noqa: E402
from app.models import PracticeWorld  # noqa: E402
from lare_common.db import Database  # noqa: E402
from lare_common.security import new_id  # noqa: E402
from sqlalchemy import select  # noqa: E402


def opt(id, text, correct, feedback):
    return {"id": id, "text": text, "correct": correct, "feedback": feedback}


WORLDS = [
    {
        "title": "Production Incident: Checkout is down",
        "role": "Backend On-Call Engineer",
        "skill": "Debugging",
        "difficulty": "medium",
        "summary": "It's 2:14 AM. PagerDuty is screaming. Work the incident like a pro.",
        "pass_pct": 60,
        "steps": [
            {
                "id": "s1",
                "situation": "PagerDuty pages you: 'checkout-api 5xx rate 42%'. Customers can't pay. You open the dashboard.",
                "artifact": {"type": "logs", "content": "12:14:02 ERROR CheckoutService - java.lang.NullPointerException\n  at CheckoutService.applyCoupon(CheckoutService.java:88)\n12:14:02 INFO  deploy - v2.7.0 rolled out 12:09 (5 min ago)"},
                "prompt": "What's your FIRST move?",
                "options": [
                    opt("a", "Restart every pod and hope it clears", False, "Restarting hides the cause and the NPE will return on the next request."),
                    opt("b", "Correlate the errors with the 12:09 deploy and read the stack trace", True, "Exactly — a spike right after a deploy is your prime suspect; the trace points at applyCoupon()."),
                    opt("c", "Post 'looking into it' and wait 15 min for more data", False, "Customers are failing to pay now — triage immediately, don't wait."),
                ],
            },
            {
                "id": "s2",
                "situation": "The NPE is in applyCoupon(). v2.7.0 added coupon support. Most failing requests have no coupon.",
                "artifact": {"type": "code", "content": "String code = req.getCoupon();\ndouble pct = coupons.get(code).getPercent(); // NPE when code == null"},
                "prompt": "Fastest safe action to stop the bleeding?",
                "options": [
                    opt("a", "Roll back to v2.6.0 now, then fix forward calmly", True, "Right call — rollback restores service in seconds; you fix the null-check without pressure."),
                    opt("b", "Hotfix, run full CI, and deploy in ~40 min", False, "Correct eventually, but 40 minutes of failed checkouts is not acceptable when a rollback is available."),
                    opt("c", "Disable the whole checkout service", False, "That turns a partial outage into a total one — worse for customers."),
                ],
            },
            {
                "id": "s3",
                "situation": "Rollback done, 5xx back to 0.1%. Now the fix.",
                "prompt": "What belongs in the fix + follow-up?",
                "options": [
                    opt("a", "Add the null/empty coupon guard, a regression test, and a postmortem", True, "That's the professional close-out: fix, prevent recurrence, and learn from it."),
                    opt("b", "Just add the null check and move on", False, "No test means the same bug can ship again; no postmortem means the team doesn't learn."),
                    opt("c", "Blame the deploy tooling in the channel", False, "Blameless postmortems fix systems, not people — this erodes trust and fixes nothing."),
                ],
            },
        ],
    },
    {
        "title": "Data Investigation: the revenue dip",
        "role": "Data Analyst",
        "skill": "SQL",
        "difficulty": "medium",
        "summary": "Leadership sees a 12% revenue drop this week. Find out what's real.",
        "pass_pct": 60,
        "steps": [
            {
                "id": "s1",
                "situation": "You're asked: 'Why did revenue fall 12% this week?' You have the orders table.",
                "artifact": {"type": "table", "content": "orders(id, user_id, amount, status, created_at, country)"},
                "prompt": "Where do you start?",
                "options": [
                    opt("a", "Immediately tell leadership a competitor launched", False, "You have no evidence yet — never lead with a guess as if it's fact."),
                    opt("b", "Break the drop down by day, country, and status before concluding anything", True, "Yes — segment first; aggregates hide the real story."),
                    opt("c", "Export all rows to a spreadsheet and eyeball them", False, "Doesn't scale and invites errors; query the data with a hypothesis."),
                ],
            },
            {
                "id": "s2",
                "situation": "You run the breakdown. One row stands out.",
                "artifact": {"type": "table", "content": "status      | orders | revenue\ncompleted   | 8,910  | $445k\nPENDING     | 2,140  | $61k   <-- up 6x vs last week\nrefunded    | 120    | $6k"},
                "prompt": "What does the PENDING spike most likely mean?",
                "options": [
                    opt("a", "Real revenue is down — customers stopped buying", False, "Orders are still being placed; they're just stuck in PENDING, not lost."),
                    opt("b", "A payment/webhook issue is leaving paid orders stuck in PENDING", True, "Right — the demand is there; a pipeline problem is under-counting completed revenue."),
                    opt("c", "The refunds caused the dip", False, "Refunds are flat and tiny ($6k) — not the driver."),
                ],
            },
            {
                "id": "s3",
                "situation": "Payments confirms a webhook outage since Monday. You write up the finding.",
                "prompt": "How do you report it?",
                "options": [
                    opt("a", "'Revenue is fine; ~$60k is stuck in PENDING due to a webhook outage since Mon — fix + backfill recommended.'", True, "Clear, quantified, root-caused, with a next step — exactly what leadership needs."),
                    opt("b", "'Revenue dropped 12%.'", False, "Technically the raw number, but misleading — the money isn't lost, and you'd trigger the wrong response."),
                    opt("c", "Wait until it's fully fixed before saying anything", False, "Leadership is asking now; a timely, accurate interim finding is your job."),
                ],
            },
        ],
    },
    {
        "title": "Code Review: the risky pull request",
        "role": "Software Engineer",
        "skill": "Code Review",
        "difficulty": "easy",
        "summary": "A teammate opens a PR under deadline pressure. Review it well.",
        "pass_pct": 60,
        "steps": [
            {
                "id": "s1",
                "situation": "A PR adds a login endpoint. You review the diff.",
                "artifact": {"type": "code", "content": "query = \"SELECT * FROM users WHERE email='\" + email + \"'\"\ndb.execute(query)  # returns user, then checks password in code"},
                "prompt": "Your top comment?",
                "options": [
                    opt("a", "'Nit: rename query to sql'", False, "You'd be polishing brass while the ship has a hole — there's a SQL-injection here."),
                    opt("b", "'This is SQL injection — use a parameterised query. Blocking.'", True, "Correct and appropriately blocking; string-concatenated SQL with user input is a critical vuln."),
                    opt("c", "Approve — it works and we're on a deadline", False, "Deadlines don't justify shipping an injectable auth endpoint."),
                ],
            },
            {
                "id": "s2",
                "situation": "They push a fix using parameters. You also notice passwords compared with ==.",
                "artifact": {"type": "code", "content": "if (input_password == stored_password) { grant() }  // plaintext compare"},
                "prompt": "Next comment?",
                "options": [
                    opt("a", "'Store a salted hash (bcrypt/argon2) and compare hashes, not plaintext.'", True, "Right — plaintext passwords are a serious risk; hashing is non-negotiable."),
                    opt("b", "'Looks good now, approving.'", False, "The plaintext comparison implies plaintext storage — still unsafe."),
                    opt("c", "'Use === instead of =='", False, "The operator isn't the problem; storing/handling plaintext passwords is."),
                ],
            },
            {
                "id": "s3",
                "situation": "Both issues fixed, tests added. The author is frustrated by the back-and-forth.",
                "prompt": "How do you close the review?",
                "options": [
                    opt("a", "Approve, thank them, and note the two catches will help the whole team", True, "Good — reinforce the outcome positively; reviews are collaborative, not adversarial."),
                    opt("b", "Approve with 'finally.'", False, "Snark damages trust and makes people hide future work — keep it constructive."),
                    opt("c", "Ask a senior to re-review from scratch", False, "Unnecessary now that the issues are fixed and tested; it just wastes time."),
                ],
            },
        ],
    },
]

TITLES = {w["title"] for w in WORLDS}


def main():
    cfg = AssessmentConfig()
    db = Database(cfg.DATABASE_URL, echo=False, schema=cfg.DB_SCHEMA)
    db.create_all()

    if len(sys.argv) > 1 and sys.argv[1] == "clean":
        with db.session() as s:
            rows = s.execute(select(PracticeWorld).where(
                PracticeWorld.title.in_(TITLES))).scalars().all()
            for w in rows:
                s.delete(w)
        print("Removed {} practice worlds.".format(len(rows)))
        return

    created = updated = 0
    with db.session() as s:
        for w in WORLDS:
            row = s.execute(select(PracticeWorld).where(
                PracticeWorld.title == w["title"])).scalars().first()
            if row is None:
                row = PracticeWorld(id=new_id(), title=w["title"])
                s.add(row)
                created += 1
            else:
                updated += 1
            row.role = w["role"]
            row.skill = w["skill"]
            row.difficulty = w["difficulty"]
            row.summary = w["summary"]
            row.steps = w["steps"]
            row.pass_pct = w["pass_pct"]
        s.flush()
    print("Practice Worlds seeded: {} created, {} updated ({} scenarios).".format(
        created, updated, len(WORLDS)))
    print("Learners can play them in LARE Learn -> Practice Worlds.")


if __name__ == "__main__":
    main()
