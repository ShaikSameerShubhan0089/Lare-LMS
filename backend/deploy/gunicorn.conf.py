"""Shared Gunicorn config for every LARE service (production).

Bind/port come from the systemd ExecStart (--bind). Workers scale with CPUs;
the event-bus consumer runs inside each worker, so keep workers modest and rely
on Redis consumer groups for fan-out. Exam/coding services can raise timeout.
"""
import multiprocessing
import os

workers = int(os.getenv("WEB_CONCURRENCY", str(min(4, multiprocessing.cpu_count() * 2 + 1))))
threads = int(os.getenv("WEB_THREADS", "2"))
worker_class = "gthread"
timeout = int(os.getenv("WEB_TIMEOUT", "60"))
graceful_timeout = 30
keepalive = 5
max_requests = 2000
max_requests_jitter = 200
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
