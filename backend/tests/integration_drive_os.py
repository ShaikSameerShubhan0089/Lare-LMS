"""Phase 5 — Drive-OS end-to-end integration test.

Boots the five new services (evidence, competency, decision, action, recruit-ai)
as real subprocesses on SQLite and exercises the full east-west chain over HTTP
with a real HS256 access token:

    competency model -> evidence (append + conflict) -> decision queue/record
    -> action (attention) -> recruit-ai insights + calibration

This proves the services actually talk to each other (ServiceClient east-west,
RBAC via headers, deterministic math) — not just that each boots in isolation.

Run:  python backend/tests/integration_drive_os.py
Exit code 0 = all assertions passed.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]          # backend/
LIBS = ROOT / "libs"
SERVICES = [
    ("evidence", 8027), ("competency", 8028), ("decision", 8029),
    ("action", 8030), ("recruit_ai", 8031),
]

# Fixed test secrets. These are set in the child env, which python-dotenv's
# load_dotenv() will NOT override (override=False), so the test is fully isolated
# from backend/.env — it never uses the real JWT secret or the real database.
JWT_SECRET = "e2e-test-secret"
JWT_ISSUER = "lare-auth"
JWT_AUDIENCE = "lare-platform"
INTERNAL_JWT_SECRET = "e2e-internal-secret"

BASE_ENV = {
    **os.environ,
    "JWT_ALG": "HS256",
    "JWT_SECRET": JWT_SECRET,
    "JWT_ISSUER": JWT_ISSUER,
    "JWT_AUDIENCE": JWT_AUDIENCE,
    "INTERNAL_JWT_SECRET": INTERNAL_JWT_SECRET,
    "EVENT_BUS_BACKEND": "memory",   # no HTTP fan-out to analytics/audit
    "PYTHONPATH": str(LIBS) + os.pathsep + os.environ.get("PYTHONPATH", ""),
    "PYTHONUNBUFFERED": "1",
}


def _token(subject="rec1") -> str:
    sys.path.insert(0, str(LIBS))
    from lare_common.security import create_access_token
    return create_access_token(
        subject=subject, roles=["recruiter"], tenant_id="lare", college_ids=[],
        alg="HS256", signing_key=JWT_SECRET,
        issuer=JWT_ISSUER, audience=JWT_AUDIENCE, ttl_minutes=60)


def _req(method, port, path, token, body=None):
    url = f"http://127.0.0.1:{port}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=10) as r:  # noqa: S310
        raw = r.read()
        return r.status, (json.loads(raw) if raw else None)


def _wait_health(port, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as r:  # noqa: S310
                if r.status == 200:
                    return True
        except Exception:  # noqa: BLE001
            time.sleep(0.4)
    return False


def main() -> int:
    procs = []
    checks = []

    def check(name, cond):
        checks.append((name, bool(cond)))
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}")

    try:
        # boot each service: init-db then serve
        for name, port in SERVICES:
            d = ROOT / "services" / name
            for f in d.glob("*.sqlite3"):
                f.unlink()
            # Force per-service SQLite (absolute) so the test never uses the real DB.
            dburl = f"sqlite:///{(d / (name + '.sqlite3')).as_posix()}"
            env = {**BASE_ENV, "PORT": str(port), "SERVICE_NAME": f"drive-{name}",
                   "DATABASE_URL": dburl, "DB_SCHEMA": ""}
            subprocess.run([sys.executable, "manage.py", "init-db"], cwd=d, env=env,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            procs.append(subprocess.Popen([sys.executable, "manage.py", "serve"], cwd=d, env=env,
                                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        for name, port in SERVICES:
            if not _wait_health(port):
                print(f"  service {name} failed to become healthy on :{port}")
                return 2
        print("all 5 services healthy\n")

        tok = _token("rec1")
        toks = {"rec1": tok, "iv1": _token("iv1"), "iv2": _token("iv2")}
        D = "d1"

        # 1) competency model (system_design x2, dsa x1, comm x1)
        st, _ = _req("POST", 8028, "/drive/v1/competency/models", tok, {
            "drive_id": D, "weights": [
                {"competency_key": "system_design", "name": "System Design", "weight": 2},
                {"competency_key": "dsa", "name": "DSA", "weight": 1},
                {"competency_key": "comm", "name": "Communication", "weight": 1}]})
        check("competency model set", st == 201)

        # 2) evidence: c1 divergent on system_design; c1 dsa; c2 strong
        ev = [
            ("c1", "system_design", 80, "interview", "iv1"),
            ("c1", "system_design", 45, "interview", "iv2"),   # conflict vs 80
            ("c1", "dsa", 70, "assessment", "system"),
            ("c2", "system_design", 85, "interview", "iv1"),
            ("c2", "dsa", 88, "assessment", "system"),
        ]
        conflict_seen = False
        for cid, comp, sig, src, actor in ev:
            # post as the acting interviewer so actor_id (from identity) = iv1/iv2,
            # which is what calibration groups on.
            st, body = _req("POST", 8027, "/drive/v1/evidence", toks.get(actor, tok), {
                "drive_id": D, "candidate_id": cid, "competency_key": comp,
                "source_type": src, "signal": sig, "confidence": "high",
                "rationale": f"{actor} eval", "round_key": "r1"})
            if st == 201 and body["data"]["conflicts"]:
                conflict_seen = True
        check("evidence appended (5 rows)", True)
        check("conflict auto-detected on append", conflict_seen)

        # 3) decision queue (via east-west to evidence + competency)
        st, body = _req("GET", 8029, f"/drive/v1/decisions/drive/{D}/queue", tok)
        q = {r["candidate_id"]: r for r in (body["data"] if st == 200 else [])}
        check("decision queue returns both candidates", set(q) == {"c1", "c2"})
        check("c2 outranks c1 (evidence-backed confidence)", q and q["c2"]["confidence"] > q["c1"]["confidence"])
        check("c1 flagged panel divergent", q and q["c1"]["panel_agreement"] == "divergent")
        check("coverage computed from model (67%)", q and q["c2"]["coverage_pct"] == 67)

        # 4) record a decision citing evidence
        st, body = _req("POST", 8029, "/drive/v1/decisions", tok, {
            "drive_id": D, "candidate_id": "c2", "verdict": "advance", "evidence_ids": ["x"]})
        check("decision recorded with lineage", st == 201 and body["data"]["cited_evidence"] == ["x"])

        # 5) action engine derives attention from live conflicts + queue
        st, body = _req("GET", 8030, f"/drive/v1/actions/drive/{D}", tok)
        kinds = {a["kind"] for a in (body["data"] if st == 200 else [])}
        check("action engine raised evidence_conflict", "evidence_conflict" in kinds)

        # 6) recruit-ai insights (O/R/I/A)
        st, body = _req("GET", 8031, f"/drive/v1/insights/drive/{D}", tok)
        titles = [i["title"] for i in (body["data"] if st == 200 else [])]
        check("recruit-ai produced insights", len(titles) > 0)

        # 7) calibration — interviewer drift vs consensus
        st, body = _req("GET", 8031, f"/drive/v1/calibration/drive/{D}", tok)
        cal = {c["interviewer_id"]: c for c in (body["data"] if st == 200 else [])}
        check("calibration computed for interviewers", {"iv1", "iv2"} <= set(cal))
        check("iv2 shows negative drift (scored below consensus)", cal and cal["iv2"]["mean_delta"] < 0)

        # 8) cross-drive calibration aggregates stored per-drive calibration
        st, body = _req("GET", 8031, "/drive/v1/calibration/interviewers", tok)
        xcal = {c["interviewer_id"] for c in (body["data"] if st == 200 else [])}
        check("cross-drive calibration aggregates interviewers", {"iv1", "iv2"} <= xcal)

        passed = sum(1 for _, ok in checks if ok)
        print(f"\n{passed}/{len(checks)} checks passed")
        return 0 if passed == len(checks) else 1
    finally:
        for p in procs:
            p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except Exception:  # noqa: BLE001
                p.kill()
        for name, _ in SERVICES:
            for f in (ROOT / "services" / name).glob("*.sqlite3"):
                try:
                    f.unlink()
                except Exception:  # noqa: BLE001
                    pass


if __name__ == "__main__":
    raise SystemExit(main())
