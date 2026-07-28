#!/usr/bin/env bash
# One-time Postgres bootstrap: create each service's schema + tables in the
# shared Supabase database (schema-per-service). Reads DATABASE_URL from the env.
# Schema name = registry service name (matches run-all.ps1).
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
: "${DATABASE_URL:?set DATABASE_URL first}"

pass=0; fail=0
while IFS= read -r line; do
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$line" ] && continue
  case "$line" in \#*) continue;; esac
  name="$(echo "$line" | awk '{print $1}')"
  dir="$(echo "$line" | awk '{print $2}')"
  [ "$name" = "gateway" ] && continue            # proxy, no DB
  svcdir="$ROOT/services/$dir"
  [ -f "$svcdir/manage.py" ] || continue
  if [ "$name" = "auth" ]; then
    py="$svcdir/venv/Scripts/python.exe"
  else
    py="$ROOT/.venv/Scripts/python.exe"
  fi
  # Avoid Supabase-reserved schema names (auth/storage/realtime/...).
  sch="$name"
  case "$name" in auth|storage|realtime|graphql|vault|cron|net|extensions) sch="lare_$name";; esac
  out="$(cd "$svcdir" && DB_SCHEMA="$sch" "$py" manage.py init-db 2>&1 | grep -vE '^\{"ts"')"
  if echo "$out" | grep -qi "tables created"; then
    echo "  ok    $name  (schema=$name)"; pass=$((pass+1))
  else
    echo "  FAIL  $name"; echo "$out" | tail -3; fail=$((fail+1))
  fi
done < "$ROOT/services.txt"
echo "---"; echo "bootstrapped: $pass ok, $fail failed"
