"""Zero-dependency concurrent load generator (NFR #35).

Fires N concurrent workers at a URL for a fixed duration and reports throughput,
error rate, and latency percentiles — enough to validate the "1000 students at a
time" target against a running gateway/service.

Usage:
  python tools/loadtest.py --url http://127.0.0.1:8000/health --concurrency 100 --duration 10
  python tools/loadtest.py --url http://127.0.0.1:8022/health -c 500 -d 15
"""
from __future__ import annotations

import argparse
import statistics
import threading
import time
import urllib.request

_stop = threading.Event()
_lock = threading.Lock()
_latencies: list[float] = []
_ok = 0
_err = 0


def _worker(url: str, headers: dict):
    global _ok, _err
    while not _stop.is_set():
        t0 = time.perf_counter()
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as r:  # noqa: S310
                r.read()
            ms = (time.perf_counter() - t0) * 1000
            with _lock:
                _latencies.append(ms)
                _ok += 1
        except Exception:  # noqa: BLE001
            with _lock:
                _err += 1


def _pct(data: list[float], p: float) -> float:
    if not data:
        return 0.0
    data = sorted(data)
    k = min(len(data) - 1, int(round((p / 100) * (len(data) - 1))))
    return data[k]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("-c", "--concurrency", type=int, default=100)
    ap.add_argument("-d", "--duration", type=int, default=10)
    ap.add_argument("--header", action="append", default=[], help="Key: Value")
    args = ap.parse_args()

    headers = {}
    for h in args.header:
        k, _, v = h.partition(":")
        headers[k.strip()] = v.strip()

    print(f"Load test: {args.url}  c={args.concurrency}  d={args.duration}s")
    threads = [threading.Thread(target=_worker, args=(args.url, headers), daemon=True)
               for _ in range(args.concurrency)]
    start = time.perf_counter()
    for t in threads:
        t.start()
    time.sleep(args.duration)
    _stop.set()
    elapsed = time.perf_counter() - start

    total = _ok + _err
    rps = _ok / elapsed if elapsed else 0
    print("\n--- results ---")
    print(f"requests      : {total}  (ok={_ok}, err={_err})")
    print(f"throughput    : {rps:.0f} req/s")
    print(f"error rate    : {(_err / total * 100 if total else 0):.2f}%")
    if _latencies:
        print(f"latency p50   : {_pct(_latencies, 50):.1f} ms")
        print(f"latency p95   : {_pct(_latencies, 95):.1f} ms")
        print(f"latency p99   : {_pct(_latencies, 99):.1f} ms")
        print(f"latency max   : {max(_latencies):.1f} ms")
        print(f"latency mean  : {statistics.mean(_latencies):.1f} ms")


if __name__ == "__main__":
    main()
