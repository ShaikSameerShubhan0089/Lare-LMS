"""Smoke test for the Gamification Service (Gateway identity via headers)."""
import json
import sys

from dotenv import load_dotenv
load_dotenv()

from app.factory import build_app

app = build_app()
c = app.test_client()
SVC = {"X-User-Id": "u-svc", "X-Roles": "company_admin"}   # trusted internal writer
S1 = {"X-User-Id": "learner-1", "X-Roles": "student"}
S2 = {"X-User-Id": "learner-2", "X-Roles": "student"}
fails = []


def show(label, r):
    try:
        b = r.get_json()
    except Exception:
        b = {"_raw": r.get_data(as_text=True)[:150]}
    print(f"\n=== {label} -> {r.status_code}")
    print(json.dumps(b, indent=2)[:340])
    return b


# award XP (learner-1) -> level 1, total 120
r = c.post("/lms/v1/gamification/award", headers=SVC,
           json={"learner_id": "learner-1", "action": "content_complete", "points": 120,
                 "source_event_id": "evt-1", "display_name": "Asha"})
b = show("award 120", r)
if r.status_code != 200 or b["data"]["total_xp"] != 120: fails.append("award")

# idempotent: same source_event_id -> no double award
r = c.post("/lms/v1/gamification/award", headers=SVC,
           json={"learner_id": "learner-1", "action": "content_complete", "points": 120,
                 "source_event_id": "evt-1"})
b = show("award duplicate (idempotent)", r)
if b["data"]["total_xp"] != 120 or b["data"].get("idempotent") is not True:
    fails.append("idempotent")

# more XP crosses level threshold (level 2 at >=100 already; push to level 3 at >=300)
r = c.post("/lms/v1/gamification/award", headers=SVC,
           json={"learner_id": "learner-1", "action": "assessment_pass", "points": 250,
                 "source_event_id": "evt-2"})
b = show("award 250 -> level up", r)
if b["data"]["total_xp"] != 370 or b["data"]["level"] < 3 or b["data"]["leveled_up"] is not True:
    fails.append("levelup")

# student cannot self-award
r = c.post("/lms/v1/gamification/award", headers=S1,
           json={"learner_id": "learner-1", "action": "cheat", "points": 9999})
show("student self-award (expect 403)", r)
if r.status_code != 403: fails.append("rbac")

# streaks: consecutive days -> current 3
for d in ("2026-07-20", "2026-07-21", "2026-07-22"):
    r = c.post("/lms/v1/gamification/activity", headers=SVC,
               json={"learner_id": "learner-1", "day": d})
b = show("streak 3 consecutive", r)
if b["data"]["current"] != 3: fails.append("streak")

# gap breaks streak -> current 1
r = c.post("/lms/v1/gamification/activity", headers=SVC,
           json={"learner_id": "learner-1", "day": "2026-07-25"})
b = show("streak after gap", r)
if b["data"]["current"] != 1 or b["data"]["longest"] != 3: fails.append("streak-break")

# badges: define + grant + idempotent grant
c.post("/lms/v1/gamification/badges", headers=SVC,
       json={"code": "streak_7", "name": "7-Day Streak", "icon": "flame"})
r = c.post("/lms/v1/gamification/badges/grant", headers=SVC,
           json={"learner_id": "learner-1", "badge_code": "streak_7"})
b = show("grant badge", r)
if r.status_code != 200 or b["data"]["new"] is not True: fails.append("badge")
r = c.post("/lms/v1/gamification/badges/grant", headers=SVC,
           json={"learner_id": "learner-1", "badge_code": "streak_7"})
b = show("grant badge again (idempotent)", r)
if b["data"]["new"] is not False: fails.append("badge-dup")

# second learner XP for leaderboard ordering
c.post("/lms/v1/gamification/award", headers=SVC,
       json={"learner_id": "learner-2", "action": "x", "points": 500,
             "source_event_id": "evt-3", "display_name": "Ravi"})

# leaderboard: learner-2 (500) above learner-1 (370)
r = c.get("/lms/v1/gamification/leaderboard/global", headers=S1)
b = show("leaderboard", r)
if r.status_code != 200 or b["data"][0]["learner_id"] != "learner-2" \
        or b["data"][0]["rank"] != 1: fails.append("leaderboard")

# game state: owner reads own
r = c.get("/lms/v1/gamification/learner-1", headers=S1)
b = show("own game state", r)
if r.status_code != 200 or "streak_7" not in b["data"]["badges"] \
        or b["data"]["streak"]["longest"] != 3: fails.append("state")

# other student blocked from reading learner-1 state
r = c.get("/lms/v1/gamification/learner-1", headers=S2)
show("other student state (expect 403)", r)
if r.status_code != 403: fails.append("state-block")

print("\n" + "=" * 40)
if fails:
    print("FAILURES:", fails); sys.exit(1)
print("ALL GAMIFICATION SMOKE CHECKS PASSED")
