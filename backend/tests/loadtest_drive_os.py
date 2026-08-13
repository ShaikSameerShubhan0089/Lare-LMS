"""Phase 5 — Drive-OS hot-path load test.

Boots evidence/competency/decision/action on SQLite (hermetic, like the
integration test) and hammers the three hot paths, reporting throughput and
latency percentiles:

  * evidence append  (write path — the ledger)
  * decision queue   (read path — decision -> evidence + competency east-west)
  * action recompute (read path — action -> evidence + decision east-west)

Run:  python backend/tests/loadtest_drive_os.py [appends] [reads] [workers]
Defaults: 400 appends, 120 reads, 8 workers. This is a smoke-scale benchmark on
SQLite + the dev server; it surfaces regressions and relative cost, not absolute
production numbers (Postgres + gunicorn workers behave differently).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIBS = ROOT / "libs"
SERVICES = [("evidence", 8027), ("competency", 8028), ("decision", 8029), ("action", 8030)]

JWT_SECRET = "e2e-test-secret"
BASE_ENV = {
    **os.environ, "JWT_ALG": "HS256", "JWT_SECRET": JWT_SECRET,
    "JWT_ISSUER": "lare-auth", "JWT_AUDIENCE": "lare-platform",
    "INTERNAL_JWT_SECRET": "e2e-internal-secret", "EVENT_BUS_BACKEND": "memory",
    "PYTHONPATH": str(LIBS) + os.pathsep + os.environ.get("PYTHONPATH", ""),
    "PYTHONUNBUFFERED": "1",
}
N_APPEND = int(sys.argv[1]) if len(sys.argv) > 1 else 400
N_READ = int(sys.argv[2]) if len(sys.argv) > 2 else 120
WORKERS = int(sys.argv[3]) if len(sys.argv) > 3 else 8


def _token():
    sys.path.insert(0, str(LIBS))
    from lare_common.security import create_access_token
    return create_access_token(subject="rec1", roles=["recruiter"], tenant_id="lare",
                               college_ids=[], alg="HS256", signing_key=JWT_SECRET,
                               issuer="lare-auth", audience="lare-platform", ttl_minutes=60)


def _call(method, port, path, tok, body=None):
    """Returns latency in ms, or None on error (counted as a failure)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=data, method=method,
                                 headers={"Content-Type": "application/json", "Authorization": f"Bearer {tok}"})
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310
            r.read()
        return (time.perf_counter() - t0) * 1000  # ms
    except Exception:  # noqa: BLE001 — SQLite write locking surfaces as 500 under concurrency
        return None


def _health(port, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as r:  # noqa: S310
                if r.status == 200:
                    return True
        except Exception:  # noqa: BLE001
            time.sleep(0.4)
    return False


def _pct(xs, p):
    if not xs:
        return 0.0
    s = sorted(xs)
    return s[min(len(s) - 1, int(len(s) * p / 100))]


def _bench(name, jobs, worker, workers=None):
    jobs = list(jobs)
    t0 = time.perf_counter()
    lat, failed = [], 0
    with ThreadPoolExecutor(max_workers=workers or WORKERS) as ex:
        for ms in ex.map(worker, jobs):
            if ms is not None:
                lat.append(ms)
            else:
                failed += 1
    wall = time.perf_counter() - t0
    thr = len(lat) / wall if wall else 0
    print(f"  {name:<22} ok={len(lat):<5} fail={failed:<4} {thr:7.1f} req/s   "
          f"p50={_pct(lat,50):6.1f}ms  p95={_pct(lat,95):6.1f}ms  max={max(lat) if lat else 0:6.1f}ms")


def main():
    procs = []
    try:
        for name, port in SERVICES:
            d = ROOT / "services" / name
            for f in d.glob("*.sqlite3"):
                f.unlink()
            env = {**BASE_ENV, "PORT": str(port), "SERVICE_NAME": f"drive-{name}",
                   "DATABASE_URL": f"sqlite:///{(d / (name + '.sqlite3')).as_posix()}", "DB_SCHEMA": ""}
            subprocess.run([sys.executable, "manage.py", "init-db"], cwd=d, env=env,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            procs.append(subprocess.Popen([sys.executable, "manage.py", "serve"], cwd=d, env=env,
                                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        for _, port in SERVICES:
            if not _health(port):
                print(f"service on :{port} unhealthy")
                return 2
        tok = _token()
        D = "load"
        comps = ["system_design", "dsa", "comm", "coding"]
        _call("POST", 8028, "/drive/v1/competency/models", tok,
              {"drive_id": D, "weights": [{"competency_key": c, "name": c, "weight": 1} for c in comps]})
        print(f"\nload test: {N_APPEND} appends, {N_READ} reads, {WORKERS} workers\n")

        def append_job(i):
            return _call("POST", 8027, "/drive/v1/evidence", tok, {
                "drive_id": D, "candidate_id": f"c{i % 50}", "competency_key": comps[i % 4],
                "source_type": "assessment", "signal": (i * 7) % 101, "confidence": "high"})

        def queue_job(_):
            return _call("GET", 8029, f"/drive/v1/decisions/drive/{D}/queue", tok)

        def action_job(_):
            return _call("GET", 8030, f"/drive/v1/actions/drive/{D}", tok)

        # SQLite serializes writers, so the append (write) phase uses low concurrency
        # to avoid "database is locked"; reads run at full WORKERS. On Postgres the
        # write path scales with the connection pool.
        _bench("evidence append", range(N_APPEND), append_job, workers=2)   # write path
        _bench("decision queue", range(N_READ), queue_job)                  # read path (east-west)
        _bench("action recompute", range(N_READ), action_job)              # read path (east-west)
        print("\n(SQLite dev numbers; Postgres + gunicorn scales the write path further.)\ndone.")
        return 0
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
