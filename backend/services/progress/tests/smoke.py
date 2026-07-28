"""Smoke test for the Progress Tracking Service (Gateway identity via headers)."""
import json
import sys

from dotenv import load_dotenv
load_dotenv()

from app.factory import build_app

app = build_app()
c = app.test_client()
TR = {"X-User-Id": "u-tr", "X-Roles": "trainer"}
LEARNER = "learner-1"
STUD = {"X-User-Id": LEARNER, "X-Roles": "student"}
OTHER = {"X-User-Id": "someone-else", "X-Roles": "student"}
fails = []


def show(label, r):
    try:
        b = r.get_json()
    except Exception:
        b = {"_raw": r.get_data(as_text=True)[:150]}
    print(f"\n=== {label} -> {r.status_code}")
    print(json.dumps(b, indent=2)[:320])
    return b


# attendance: 4 present, 1 absent -> 80%
for st in ("present", "present", "present", "present", "absent"):
    c.post("/lms/v1/attendance", headers=TR,
           json={"learner_id": LEARNER, "schedule_slot_id": "slot-1", "status": st})

# scores across dimensions (year 2)
for dim, val in [("coding", 84), ("aptitude", 78), ("communication", 72), ("project", 66)]:
    r = c.post("/lms/v1/progress/score", headers=TR,
               json={"learner_id": LEARNER, "year_no": 2, "dimension": dim, "value": val,
                     "source": "assessment"})
b = show("record scores -> scorecard", r)
if r.status_code != 200 or b["data"]["coding"] != 84: fails.append("score")

# averaging: add second coding score 90 -> coding avg (84+90)/2 = 87
r = c.post("/lms/v1/progress/score", headers=TR,
           json={"learner_id": LEARNER, "year_no": 2, "dimension": "coding", "value": 90})
b = show("second coding score (avg)", r)
if b["data"]["coding"] != 87.0: fails.append("avg")

# student cannot write scores
r = c.post("/lms/v1/progress/score", headers=STUD,
           json={"learner_id": LEARNER, "year_no": 2, "dimension": "coding", "value": 100})
show("student write score (expect 403)", r)
if r.status_code != 403: fails.append("rbac")

# module progress
c.post("/lms/v1/progress/module", headers=TR,
       json={"learner_id": LEARNER, "module_id": "mod-dsa", "completion_pct": 75})

# compute year: attendance 80% & avg score >= 60 -> met
r = c.post("/lms/v1/progress/compute-year", headers=TR,
           json={"learner_id": LEARNER, "year_no": 2})
b = show("compute year status", r)
if r.status_code != 200 or b["data"]["attendance_pct"] != 80.0 \
        or b["data"]["criteria_met"] is not True \
        or b["data"]["signal"] != "year.completed":
    fails.append("year")

# owner student reads own scorecard
r = c.get(f"/lms/v1/progress/{LEARNER}/scorecard", headers=STUD)
b = show("owner scorecard", r)
if r.status_code != 200 or b["data"][0]["coding"] != 87.0: fails.append("read-own")

# other student blocked
r = c.get(f"/lms/v1/progress/{LEARNER}/scorecard", headers=OTHER)
show("other student scorecard (expect 403)", r)
if r.status_code != 403: fails.append("read-block")

# summary
r = c.get(f"/lms/v1/progress/{LEARNER}", headers=TR)
b = show("summary", r)
if r.status_code != 200 or b["data"]["attendance_pct"] != 80.0 \
        or len(b["data"]["modules"]) != 1:
    fails.append("summary")

print("\n" + "=" * 40)
if fails:
    print("FAILURES:", fails); sys.exit(1)
print("ALL PROGRESS SMOKE CHECKS PASSED")
