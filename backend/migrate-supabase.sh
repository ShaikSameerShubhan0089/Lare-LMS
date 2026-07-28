#!/usr/bin/env bash
# Apply backend/sql/all_schemas.sql to Postgres (Supabase). Idempotent.
# Usage:  DATABASE_URL='postgresql+psycopg://...' bash migrate-supabase.sh
#   (or just `bash migrate-supabase.sh` — it reads DATABASE_URL from backend/.env)
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Fall back to DATABASE_URL from .env if not already exported.
if [ -z "${DATABASE_URL:-}" ] && [ -f "$ROOT/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
  export DATABASE_URL
fi
: "${DATABASE_URL:?set DATABASE_URL (or add it to backend/.env)}"

"$ROOT/.venv/Scripts/python.exe" - "$ROOT/sql/all_schemas.sql" <<'PY'
import os, re, sys
from sqlalchemy import create_engine, text
raw = open(sys.argv[1], "r", encoding="utf-8").read()
# Strip comment lines, then split into statements on ';' (our generated DDL has
# no embedded semicolons, so this is safe).
sql = "\n".join(l for l in raw.splitlines() if not l.strip().startswith("--"))
stmts = [s.strip() for s in sql.split(";") if s.strip()]
e = create_engine(os.environ["DATABASE_URL"])
applied = 0
with e.begin() as c:
    for s in stmts:
        c.execute(text(s))
        applied += 1
print(f"migration applied: {applied} statements "
      f"({sum(1 for s in stmts if s.upper().startswith('CREATE SCHEMA'))} schemas, "
      f"{sum(1 for s in stmts if 'CREATE TABLE' in s.upper())} tables)")
PY
