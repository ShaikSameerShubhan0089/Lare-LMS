"""Smoke test for the Institution Service.

Simulates the Gateway by injecting trusted identity headers (X-User-Id/X-Roles),
exactly as the API Gateway does after verifying a JWT.
"""
import json
import sys

from dotenv import load_dotenv
load_dotenv()

from app.factory import build_app

app = build_app()
c = app.test_client()
ADMIN = {"X-User-Id": "u-admin", "X-Roles": "company_admin", "X-Tenant-Id": "lare"}
STUDENT = {"X-User-Id": "u-stud", "X-Roles": "student"}
fails = []


def show(label, r):
    try:
        b = r.get_json()
    except Exception:
        b = {"_raw": r.get_data(as_text=True)[:150]}
    print(f"\n=== {label} -> {r.status_code}")
    print(json.dumps(b, indent=2)[:400])
    return b


# create college
r = c.post("/lms/v1/colleges", headers=ADMIN, json={
    "name": "Aditya College of Engineering", "address": "Madanapalle 517325",
    "mou_ref": "LARE-ADITYA-2026",
})
b = show("create college", r)
if r.status_code != 201: fails.append("create-college")
cid = b["data"]["id"]

# RBAC: student cannot create
r = c.post("/lms/v1/colleges", headers=STUDENT, json={"name": "X College"})
show("student create college (expect 403)", r)
if r.status_code != 403: fails.append("rbac")

# no identity -> 401
r = c.post("/lms/v1/colleges", json={"name": "Y College"})
show("no-auth create (expect 401)", r)
if r.status_code != 401: fails.append("noauth")

# branches (CSE allied + core)
r = c.post(f"/lms/v1/colleges/{cid}/branches", headers=ADMIN,
           json={"name": "Computer Science", "code": "CSE", "category": "cse_allied"})
b = show("add branch CSE", r)
if r.status_code != 201: fails.append("branch")
branch_id = b["data"]["id"]
c.post(f"/lms/v1/colleges/{cid}/branches", headers=ADMIN,
       json={"name": "Mechanical", "code": "MECH", "category": "core"})

# duplicate branch code -> 409
r = c.post(f"/lms/v1/colleges/{cid}/branches", headers=ADMIN,
           json={"name": "CSE dup", "code": "CSE"})
show("duplicate branch (expect 409)", r)
if r.status_code != 409: fails.append("branch-dup")

# calendar: year + odd/even semesters
r = c.post(f"/lms/v1/colleges/{cid}/calendar", headers=ADMIN, json={
    "year_no": 2, "semesters": [{"type": "odd"}, {"type": "even"}],
})
b = show("add academic year", r)
if r.status_code != 201: fails.append("calendar")
r = c.get(f"/lms/v1/colleges/{cid}/calendar", headers=ADMIN)
cal = show("list calendar", r)
sem_id = cal["data"][0]["semesters"][0]["id"]

# cohort
r = c.post(f"/lms/v1/colleges/{cid}/cohorts", headers=ADMIN,
           json={"branch_id": branch_id, "section": "A", "year_no": 2, "size": 60})
show("add cohort", r)
if r.status_code != 201: fails.append("cohort")

# schedule slot + overlap guard
r = c.post(f"/lms/v1/colleges/{cid}/schedule", headers=ADMIN,
           json={"semester_id": sem_id, "branch_id": branch_id, "week_no": 1,
                 "module_ref": "DSA-Basics"})
show("add schedule slot", r)
if r.status_code != 201: fails.append("slot")
r = c.post(f"/lms/v1/colleges/{cid}/schedule", headers=ADMIN,
           json={"semester_id": sem_id, "branch_id": branch_id, "week_no": 1})
show("duplicate slot (expect 409 slot_overlap)", r)
if r.status_code != 409: fails.append("slot-overlap")

# config get/put
r = c.put(f"/lms/v1/colleges/{cid}/config", headers=ADMIN,
          json={"passing_threshold": 65, "min_cohort_size": 40})
b = show("update config", r)
if r.status_code != 200 or b["data"]["passing_threshold"] != 65: fails.append("config")

print("\n" + "=" * 40)
if fails:
    print("FAILURES:", fails); sys.exit(1)
print("ALL INSTITUTION SMOKE CHECKS PASSED")
