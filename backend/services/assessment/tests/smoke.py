"""Smoke test for the Assessment Service (Gateway identity via headers)."""
import json
import sys

from dotenv import load_dotenv
load_dotenv()

from app.factory import build_app

app = build_app()
c = app.test_client()
TR = {"X-User-Id": "u-tr", "X-Roles": "trainer"}
STUD = {"X-User-Id": "learner-1", "X-Roles": "student"}
OTHER = {"X-User-Id": "learner-2", "X-Roles": "student"}
fails = []


def show(label, r):
    try:
        b = r.get_json()
    except Exception:
        b = {"_raw": r.get_data(as_text=True)[:150]}
    print(f"\n=== {label} -> {r.status_code}")
    print(json.dumps(b, indent=2)[:340])
    return b


# create an assessment: 1 mcq (weight 1) + 1 subjective (weight 1)
r = c.post("/lms/v1/assessments", headers=TR, json={
    "title": "Year 2 Aptitude Quiz", "year_no": 2, "type": "aptitude",
    "passing_pct": 60, "dimension": "aptitude", "attempts_allowed": 1,
    "items": [
        {"item_type": "mcq", "prompt": "2+2?", "weight": 1, "order": 1,
         "options": [{"id": "a", "text": "3"}, {"id": "b", "text": "4"}],
         "correct": {"option": "b"}},
        {"item_type": "subjective", "prompt": "Explain recursion.", "weight": 1, "order": 2,
         "rubric_hint": "clarity + base case + example"},
    ],
})
b = show("create assessment", r)
if r.status_code != 201: fails.append("create")
aid = b["data"]["id"]

# student cannot author
r = c.post("/lms/v1/assessments", headers=STUD, json={"title": "X"})
show("student author (expect 403)", r)
if r.status_code != 403: fails.append("rbac")

# fetch for attempt -> no answer key leaked
r = c.get(f"/lms/v1/assessments/{aid}", headers=STUD)
b = show("get assessment (no key)", r)
if any("correct" in it for it in b["data"]["items"]): fails.append("key-leak")

# start attempt
r = c.post(f"/lms/v1/assessments/{aid}/attempts", headers=STUD, json={"learner_id": "learner-1"})
b = show("start attempt", r)
if r.status_code != 201: fails.append("start")
attempt = b["data"]["attempt_id"]
items = {it["order"]: it["id"] for it in b["data"]["items"]}
mcq_id, subj_id = items[1], items[2]

# submit: correct mcq + subjective text
r = c.post(f"/lms/v1/attempts/{attempt}/submit", headers=STUD, json={
    "answers": {mcq_id: {"option": "b"}, subj_id: {"text": "A function calling itself..."}},
})
b = show("submit (mcq auto-graded, subjective pending)", r)
# mcq correct = 1/2 so far; subjective pending -> status submitted, not graded
if r.status_code != 200 or b["data"]["status"] != "submitted" \
        or b["data"]["score"] != 1.0 or len(b["data"]["pending_grading"]) != 1:
    fails.append("submit")
pending_answer = b["data"]["pending_grading"][0]

# double submit -> 409
r = c.post(f"/lms/v1/attempts/{attempt}/submit", headers=STUD, json={"answers": {}})
show("double submit (expect 409)", r)
if r.status_code != 409: fails.append("double-submit")

# another student cannot submit someone else's attempt (start fresh one to test forbidden submit)
# grade subjective 1.0 -> now graded, total 2/2 = 100% passed
r = c.post(f"/lms/v1/answers/{pending_answer}/grade", headers=TR, json={"score": 1.0})
b = show("grade subjective", r)
if r.status_code != 200 or b["data"]["status"] != "graded" \
        or b["data"]["percentage"] != 100.0 or b["data"]["passed"] is not True:
    fails.append("grade")

# grade above weight -> 409
r = c.post(f"/lms/v1/answers/{pending_answer}/grade", headers=TR, json={"score": 5.0})
show("grade above weight (expect 409)", r)
if r.status_code != 409: fails.append("grade-high")

# attempts exhausted -> 409
r = c.post(f"/lms/v1/assessments/{aid}/attempts", headers=STUD, json={"learner_id": "learner-1"})
show("second attempt (expect 409 exhausted)", r)
if r.status_code != 409: fails.append("exhausted")

# summary feeds scorecard
r = c.get("/lms/v1/assessments/summary?learner_id=learner-1", headers=TR)
b = show("learner summary", r)
if r.status_code != 200 or b["data"][0]["percentage"] != 100.0 \
        or b["data"][0]["dimension"] != "aptitude":
    fails.append("summary")

print("\n" + "=" * 40)
if fails:
    print("FAILURES:", fails); sys.exit(1)
print("ALL ASSESSMENT SMOKE CHECKS PASSED")
