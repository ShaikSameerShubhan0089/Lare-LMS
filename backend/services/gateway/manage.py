"""CLI: serve | run  (API gateway on :8000)."""
import os
import sys

from dotenv import load_dotenv

load_dotenv()

from app.factory import build_app  # noqa: E402


def cmd_serve():
    from lare_common.serve import serve
    serve(build_app(), host="127.0.0.1", port=int(os.getenv("PORT", "8000")))


def cmd_run():
    build_app().run(host="127.0.0.1", port=int(os.getenv("PORT", "8000")), debug=True)


COMMANDS = {"serve": cmd_serve, "run": cmd_run}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print("Usage: python manage.py [serve|run]")
        raise SystemExit(1)
    COMMANDS[sys.argv[1]]()
