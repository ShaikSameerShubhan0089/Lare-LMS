#!/usr/bin/env bash
# Linux twin of run-all.ps1 — start the gateway + 26 services from the active
# venv, each on its own port. Loads backend/.env, gives each service its own
# schema (Postgres) or SQLite file, runs init-db, then serves in the background.
#
#   ./run-all.sh            # start everything
#   PYTHON=python3 ./run-all.sh
#
# Logs: backend/.run/<name>.log    Stop: ./stop-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY="$ROOT/services.txt"
RUN="$ROOT/.run"
PY="${PYTHON:-python}"
mkdir -p "$RUN"

# Load .env (gitignored) into the environment for every child process.
if [[ -f "$ROOT/.env" ]]; then
  set -a; source <(grep -v '^[[:space:]]*#' "$ROOT/.env" | grep '='); set +a
  echo "loaded secrets from .env"
fi

# Event bus: redis when REDIS_URL is set, otherwise http fan-out.
if [[ -n "${REDIS_URL:-}" ]]; then export EVENT_BUS_BACKEND="${EVENT_BUS_BACKEND:-auto}";
else export EVENT_BUS_BACKEND="${EVENT_BUS_BACKEND:-http}"; fi

# Postgres/Supabase reserve some schema names — mirror run-all.ps1's lare_ prefix.
reserved=" auth storage realtime graphql vault cron net extensions "
schema_for() { local n="${1//-/_}"; [[ "$reserved" == *" $n "* ]] && echo "lare_$n" || echo "$n"; }

: > "$RUN/pids"
while read -r name dir port; do
  [[ -z "${name:-}" || "$name" == \#* ]] && continue
  svcdir="$ROOT/services/$dir"
  [[ -f "$svcdir/manage.py" ]] || { echo "  skip $name (no manage.py)"; continue; }

  export PORT="$port" SERVICE_NAME="$name"
  if [[ "$name" != "gateway" ]]; then
    if [[ -n "${DATABASE_URL:-}" ]]; then
      export DB_SCHEMA="$(schema_for "$name")"
    else
      export DATABASE_URL="sqlite:///$dir.sqlite3"; export DB_SCHEMA=""
    fi
    ( cd "$svcdir" && "$PY" manage.py init-db ) >/dev/null 2>&1 || echo "  warn: init-db failed for $name"
  fi

  ( cd "$svcdir" && nohup "$PY" manage.py serve >"$RUN/$name.log" 2>&1 & echo "$name $!" >> "$RUN/pids" )
  echo "  started $(printf '%-16s' "$name") :$port"
done < <(tr -d '\r' < "$REGISTRY")

echo ""
echo "All services launched. Gateway: http://127.0.0.1:8000/health"
echo "Logs: backend/.run/*.log    Stop: ./stop-all.sh"
