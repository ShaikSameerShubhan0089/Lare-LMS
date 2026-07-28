"""Smoke test for the Curriculum Service (Gateway identity simulated via headers)."""
import json
import sys

from dotenv import load_dotenv
load_dotenv()

from app.factory import build_app

app = build_app()
c = app.test_client()
CO = {"X-User-Id": "u-co", "X-Roles": "company_admin"}
TRAINER = {"X-User-Id": "u-tr", "X-Roles": "trainer"}
fails = []


def show(label, r):
    try:
        b = r.get_json()
    except Exception:
        b = {"_raw": r.get_data(as_text=True)[:150]}
    print(f"\n=== {label} -> {r.status_code}")
    print(json.dumps(b, indent=2)[:300])
    return b


# create curriculum
r = c.post("/lms/v1/curricula", headers=CO, json={"name": "LARE 4-Year Programme"})
b = show("create curriculum", r)
if r.status_code != 201: fails.append("create")
cur = b["data"]["id"]

# trainer cannot design
r = c.post("/lms/v1/curricula", headers=TRAINER, json={"name": "X"})
show("trainer create (expect 403)", r)
if r.status_code != 403: fails.append("rbac")

# add year 2 (Technical Foundation)
r = c.post(f"/lms/v1/curricula/{cur}/years", headers=CO,
           json={"year_no": 2, "theme": "Technical Foundation & Stream Discovery",
                 "goal": "Build DSA + one language, then guide stream choice"})
b = show("add year 2", r)
if r.status_code != 201: fails.append("year")
yid = b["data"]["id"]

# duplicate year -> 409
r = c.post(f"/lms/v1/curricula/{cur}/years", headers=CO, json={"year_no": 2})
show("dup year (expect 409)", r)
if r.status_code != 409: fails.append("year-dup")

# outcome check
r = c.post(f"/lms/v1/years/{yid}/outcome-checks", headers=CO,
           json={"statement": "Solid DSA + one language + counselled stream choice"})
show("add outcome check", r)
if r.status_code != 201: fails.append("outcome")

# module -> lesson -> objective
r = c.post(f"/lms/v1/years/{yid}/modules", headers=CO,
           json={"title": "Data Structures & Algorithms", "order": 1, "branch_scope": "cse_allied"})
mid = show("add module", r)["data"]["id"]
r = c.post(f"/lms/v1/modules/{mid}/lessons", headers=CO,
           json={"title": "Recursion", "order": 1})
lid = show("add lesson", r)["data"]["id"]
r = c.post(f"/lms/v1/lessons/{lid}/objectives", headers=CO,
           json={"statement": "Trace and write recursive solutions", "skill_tag": "coding"})
b = show("add objective", r)
oid = b["data"]["id"]
if any(x.status_code != 201 for x in []): pass

# map an item (content) to the objective
r = c.post(f"/lms/v1/objectives/{oid}/items", headers=CO,
           json={"item_type": "content", "item_id": "content-123"})
show("map item to objective", r)
if r.status_code != 201: fails.append("map-item")
r = c.get(f"/lms/v1/objectives/{oid}/items", headers=TRAINER)
b = show("list objective items", r)
if r.status_code != 200 or len(b["data"]) != 1: fails.append("obj-items")

# tree before publish
r = c.get(f"/lms/v1/curricula/{cur}/tree", headers=TRAINER)
b = show("tree (draft)", r)
if r.status_code != 200 or b["data"]["years"][0]["modules"][0]["lessons"][0]["objectives"][0]["skill_tag"] != "coding":
    fails.append("tree")

# map-cohort before publish -> 409 not_published
r = c.post(f"/lms/v1/curricula/{cur}/map-cohort", headers=CO, json={"cohort_id": "coh-1"})
show("map cohort before publish (expect 409)", r)
if r.status_code != 409: fails.append("map-early")

# publish
r = c.post(f"/lms/v1/curricula/{cur}/publish", headers=CO)
b = show("publish", r)
if r.status_code != 200 or b["data"]["status"] != "published": fails.append("publish")

# editing published -> 409 immutable
r = c.post(f"/lms/v1/curricula/{cur}/years", headers=CO, json={"year_no": 3})
show("edit published (expect 409 immutable)", r)
if r.status_code != 409: fails.append("immutable")

# now map-cohort works
r = c.post(f"/lms/v1/curricula/{cur}/map-cohort", headers=CO, json={"cohort_id": "coh-1"})
show("map cohort after publish", r)
if r.status_code != 201: fails.append("map-cohort")

print("\n" + "=" * 40)
if fails:
    print("FAILURES:", fails); sys.exit(1)
print("ALL CURRICULUM SMOKE CHECKS PASSED")
