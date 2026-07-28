"""Smoke test for the AI Tutor Service.

Orchestration isn't running during this test, so the tutor exercises its
graceful-degradation path (offline reply / json fallback)."""
import json
import sys

from dotenv import load_dotenv
load_dotenv()

from app.factory import build_app

app = build_app()
c = app.test_client()
STUD = {"X-User-Id": "learner-1", "X-Roles": "student"}
OTHER = {"X-User-Id": "learner-2", "X-Roles": "student"}
fails = []


def show(label, r):
    b = r.get_json()
    print(f"\n=== {label} -> {r.status_code}")
    print(json.dumps(b, indent=2)[:300])
    return b


def check(cond, msg):
    print(("  ok " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


# chat creates a session and returns a reply (offline fallback)
b = show("chat", c.post("/ai/v1/tutor/chat", headers=STUD, json={
    "message": "How do I improve my DSA?", "context": "coding=80"}))
sid = b["data"]["session_id"]
check(bool(sid), "chat created a session")
check(bool(b["data"]["reply"]), "chat returned a reply")

# follow-up in same session
b = show("chat follow-up", c.post("/ai/v1/tutor/chat", headers=STUD, json={
    "message": "And aptitude?", "session_id": sid}))
check(b["data"]["session_id"] == sid, "follow-up stays in session")

# sessions list + messages
b = show("sessions", c.get("/ai/v1/tutor/sessions", headers=STUD))
check(len(b["data"]) >= 1, "session listed")
b = show("messages", c.get(f"/ai/v1/tutor/sessions/{sid}/messages", headers=STUD))
check(len(b["data"]) == 4, "4 messages persisted (2 user, 2 assistant)")

# another learner cannot read the session
r = c.get(f"/ai/v1/tutor/sessions/{sid}/messages", headers=OTHER)
check(r.status_code == 403, "cross-learner session read blocked")

# study plan returns a plan (json fallback)
b = show("study-plan", c.post("/ai/v1/tutor/study-plan", headers=STUD, json={
    "variables": {"year_no": 2, "scorecard": {"coding": 80}, "weak_areas": ["aptitude"]}}))
check(b["data"]["plan"] is not None, "study plan returned")

# stream advice
b = show("stream-advice", c.post("/ai/v1/tutor/stream-advice", headers=STUD, json={
    "variables": {"scorecard": {"coding": 80}, "interests": "web", "branch": "CSE"}}))
check(b["data"]["advice"] is not None, "stream advice returned")

print("\n" + ("SMOKE FAILED: " + "; ".join(fails) if fails else "SMOKE PASSED"))
sys.exit(1 if fails else 0)
