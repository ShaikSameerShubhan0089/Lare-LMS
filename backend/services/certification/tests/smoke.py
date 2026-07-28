"""Smoke test for the Certification Service (Gateway identity via headers)."""
import json
import sys

from dotenv import load_dotenv
load_dotenv()

from app.factory import build_app

app = build_app()
c = app.test_client()
CO = {"X-User-Id": "u-co", "X-Roles": "company_admin"}
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


# templates for years 1 & 4
c.post("/lms/v1/cert-templates", headers=CO, json={"year_no": 1, "name": "Foundation & Personality Development"})
c.post("/lms/v1/cert-templates", headers=CO, json={"year_no": 4, "name": "Industry Readiness"})

# issue year-1 cert
r = c.post("/lms/v1/certificates/issue", headers=CO,
           json={"learner_id": "learner-1", "year_no": 1, "holder_name": "Asha Rao"})
b = show("issue Y1 cert", r)
if r.status_code != 201 or b["data"]["new"] is not True \
        or b["data"]["certificate"] != "Foundation & Personality Development":
    fails.append("issue")
verify_id = b["data"]["verify_id"]

# idempotent issue -> new: False
r = c.post("/lms/v1/certificates/issue", headers=CO,
           json={"learner_id": "learner-1", "year_no": 1})
b = show("issue again (idempotent)", r)
if b["data"]["new"] is not False: fails.append("idempotent")

# issue year-4 with PPO tag
r = c.post("/lms/v1/certificates/issue", headers=CO,
           json={"learner_id": "learner-1", "year_no": 4, "holder_name": "Asha Rao", "ppo_tag": True})
b = show("issue Y4 cert + PPO", r)
if b["data"]["ppo_tag"] is not True or b["data"]["certificate"] != "Industry Readiness":
    fails.append("ppo")
y4_id = b["data"]["id"]

# student cannot issue
r = c.post("/lms/v1/certificates/issue", headers=STUD, json={"learner_id": "learner-1", "year_no": 2})
show("student issue (expect 403)", r)
if r.status_code != 403: fails.append("rbac")

# PUBLIC verify (no auth headers) -> valid
r = c.get(f"/verify/{verify_id}")
b = show("public verify (valid)", r)
if r.status_code != 200 or b["data"]["valid"] is not True \
        or b["data"]["holder_name"] != "Asha Rao": fails.append("verify")

# owner lists own certs
r = c.get("/lms/v1/certificates/for/learner-1", headers=STUD)
b = show("owner list certs", r)
if r.status_code != 200 or len(b["data"]) != 2: fails.append("list")

# other student blocked
r = c.get("/lms/v1/certificates/for/learner-1", headers=OTHER)
show("other student list (expect 403)", r)
if r.status_code != 403: fails.append("list-block")

# revoke Y4 then verify shows invalid
r = c.post(f"/lms/v1/certificates/{y4_id}/revoke", headers=CO, json={"reason": "issued in error"})
b = show("revoke Y4", r)
if r.status_code != 200 or b["data"]["status"] != "revoked": fails.append("revoke")
y4_verify = None
for cert in c.get("/lms/v1/certificates/for/learner-1", headers=STUD).get_json()["data"]:
    if cert["year_no"] == 4:
        y4_verify = cert["verify_id"]
r = c.get(f"/verify/{y4_verify}")
b = show("verify revoked (invalid)", r)
if b["data"]["valid"] is not False or b["data"]["status"] != "revoked": fails.append("verify-revoked")

# double revoke -> 409
r = c.post(f"/lms/v1/certificates/{y4_id}/revoke", headers=CO, json={"reason": "again"})
show("double revoke (expect 409)", r)
if r.status_code != 409: fails.append("double-revoke")

print("\n" + "=" * 40)
if fails:
    print("FAILURES:", fails); sys.exit(1)
print("ALL CERTIFICATION SMOKE CHECKS PASSED")
