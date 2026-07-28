"""Smoke test for the Learner Service (Gateway identity simulated via headers)."""
import json
import sys

from dotenv import load_dotenv
load_dotenv()

from app.factory import build_app

app = build_app()
c = app.test_client()
TPO = {"X-User-Id": "u-tpo", "X-Roles": "college_admin"}
STUDENT = {"X-User-Id": "u-stud-1", "X-Roles": "student"}
fails = []


def show(label, r):
    try:
        b = r.get_json()
    except Exception:
        b = {"_raw": r.get_data(as_text=True)[:150]}
    print(f"\n=== {label} -> {r.status_code}")
    print(json.dumps(b, indent=2)[:360])
    return b


CID = "college-aditya"

# create a learner linked to a student user
r = c.post("/lms/v1/learners", headers=TPO, json={
    "user_id": "u-stud-1", "college_id": CID, "roll_no": "20CSE001",
    "full_name": "Asha Rao", "email": "asha@aditya.edu", "cgpa": 8.4, "year_no": 2,
})
b = show("create learner", r)
if r.status_code != 201: fails.append("create")
lid = b["data"]["id"]

# duplicate roll -> 409
r = c.post("/lms/v1/learners", headers=TPO, json={"college_id": CID, "roll_no": "20CSE001"})
show("dup roll (expect 409)", r)
if r.status_code != 409: fails.append("dup")

# student cannot create
r = c.post("/lms/v1/learners", headers=STUDENT, json={"college_id": CID, "roll_no": "X"})
show("student create (expect 403)", r)
if r.status_code != 403: fails.append("rbac")

# bulk import preview then commit
rows = [{"roll_no": "20CSE002", "full_name": "Ravi"},
        {"roll_no": "20CSE003", "full_name": "Sita"},
        {"roll_no": "20CSE001", "full_name": "dupe"},   # existing -> duplicate
        {"roll_no": "", "full_name": "bad"}]            # invalid
r = c.post("/lms/v1/learners/import", headers=TPO,
           json={"college_id": CID, "rows": rows, "commit": False})
b = show("import preview", r)
if r.status_code != 200 or b["data"]["valid"] != 2 or b["data"]["duplicates"] != 1 \
        or b["data"]["invalid"] != 1: fails.append("import-preview")

r = c.post("/lms/v1/learners/import", headers=TPO,
           json={"college_id": CID, "rows": rows, "commit": True})
b = show("import commit", r)
if r.status_code != 200 or b["data"].get("committed") != 2: fails.append("import-commit")

# verify
r = c.post(f"/lms/v1/learners/{lid}/verify", headers=TPO)
b = show("verify learner", r)
if r.status_code != 200 or b["data"]["verified"] is not True: fails.append("verify")

# stream selection (Year 2)
r = c.put(f"/lms/v1/learners/{lid}/stream", headers=TPO,
          json={"stream": "ai_ml", "rationale": "aptitude + interest", "mentor_user_id": "u-mentor"})
b = show("set stream", r)
if r.status_code != 200 or b["data"]["stream"] != "ai_ml": fails.append("stream")

# invalid stream -> 400
r = c.put(f"/lms/v1/learners/{lid}/stream", headers=TPO, json={"stream": "quantum"})
show("invalid stream (expect 400)", r)
if r.status_code != 400: fails.append("stream-invalid")

# student adds own project
r = c.post(f"/lms/v1/learners/{lid}/projects", headers=STUDENT,
           json={"title": "Portfolio Site", "repo_url": "https://github.com/asha/site"})
show("student add own project", r)
if r.status_code != 201: fails.append("project-own")

# a different student cannot add to this portfolio
r = c.post(f"/lms/v1/learners/{lid}/projects",
           headers={"X-User-Id": "u-other", "X-Roles": "student"},
           json={"title": "Hack"})
show("other student add project (expect 403)", r)
if r.status_code != 403: fails.append("project-other")

# profile: owner student can view
r = c.get(f"/lms/v1/learners/{lid}/profile", headers=STUDENT)
b = show("owner profile", r)
if r.status_code != 200 or b["data"]["stream"]["stream"] != "ai_ml" \
        or len(b["data"]["projects"]) != 1: fails.append("profile")

# profile: non-owner student blocked
r = c.get(f"/lms/v1/learners/{lid}/profile",
          headers={"X-User-Id": "u-other", "X-Roles": "student"})
show("non-owner profile (expect 403)", r)
if r.status_code != 403: fails.append("profile-block")

# promote to year 3
r = c.post(f"/lms/v1/learners/{lid}/promote", headers=TPO, json={"year_no": 3})
b = show("promote to Y3", r)
if r.status_code != 200 or b["data"]["year_no"] != 3: fails.append("promote")

print("\n" + "=" * 40)
if fails:
    print("FAILURES:", fails); sys.exit(1)
print("ALL LEARNER SMOKE CHECKS PASSED")
