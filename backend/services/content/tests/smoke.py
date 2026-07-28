"""Smoke test for the Content Delivery Service (Gateway identity via headers)."""
import json
import sys

from dotenv import load_dotenv
load_dotenv()

from app.factory import build_app

app = build_app()
c = app.test_client()
TR = {"X-User-Id": "u-tr", "X-Roles": "trainer"}
STUD = {"X-User-Id": "u-stud", "X-Roles": "student"}
LEARNER = "learner-1"
fails = []


def show(label, r):
    try:
        b = r.get_json()
    except Exception:
        b = {"_raw": r.get_data(as_text=True)[:150]}
    print(f"\n=== {label} -> {r.status_code}")
    print(json.dumps(b, indent=2)[:300])
    return b


LESSON = "lesson-recursion"

# create two items in a lesson
r = c.post("/lms/v1/content", headers=TR, json={
    "lesson_id": LESSON, "title": "Recursion — Intro", "type": "video",
    "duration_sec": 600, "difficulty": "easy", "order": 1, "objectives": ["obj-1"]})
a = show("create item A", r); itemA = a["data"]["id"]
if r.status_code != 201: fails.append("createA")

r = c.post("/lms/v1/content", headers=TR, json={
    "lesson_id": LESSON, "title": "Recursion — Challenge", "type": "interactive",
    "duration_sec": 1200, "difficulty": "hard", "order": 2})
b = show("create item B", r); itemB = b["data"]["id"]

# student cannot author
r = c.post("/lms/v1/content", headers=STUD, json={"lesson_id": LESSON, "title": "X", "type": "pdf"})
show("student author (expect 403)", r)
if r.status_code != 403: fails.append("rbac")

# gate: B requires A
r = c.post(f"/lms/v1/content/{itemB}/gate", headers=TR, json={"prereq_content_item_id": itemA})
show("gate B<-A", r)
if r.status_code != 201: fails.append("gate")

# playlist: A unlocked, B locked
r = c.get(f"/lms/v1/content/playlist?learner_id={LEARNER}&lesson_id={LESSON}", headers=STUD)
pl = show("playlist (B locked)", r)["data"]
byid = {i["id"]: i for i in pl}
if not byid[itemA]["unlocked"] or byid[itemB]["unlocked"]:
    fails.append("gating")

# recommendations: only A unlocked
r = c.get(f"/lms/v1/content/recommendations?learner_id={LEARNER}", headers=STUD)
rec = show("recommendations", r)["data"]
if not rec or rec[0]["id"] != itemA:
    fails.append("recommend")

# complete A
r = c.post(f"/lms/v1/content/{itemA}/progress", headers=STUD,
           json={"learner_id": LEARNER, "position_sec": 600, "completed": True})
show("complete A", r)
if r.status_code != 200: fails.append("progress")

# now B unlocked
r = c.get(f"/lms/v1/content/playlist?learner_id={LEARNER}&lesson_id={LESSON}", headers=STUD)
pl = {i["id"]: i for i in show("playlist after A done", r)["data"]}
if not pl[itemB]["unlocked"] or pl[itemA]["status"] != "completed":
    fails.append("unlock")

# recommendation now surfaces B
r = c.get(f"/lms/v1/content/recommendations?learner_id={LEARNER}", headers=STUD)
rec = show("recommendations after A", r)["data"]
if not any(x["id"] == itemB for x in rec):
    fails.append("recommend2")

print("\n" + "=" * 40)
if fails:
    print("FAILURES:", fails); sys.exit(1)
print("ALL CONTENT SMOKE CHECKS PASSED")
