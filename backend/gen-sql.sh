#!/usr/bin/env bash
# Generate PostgreSQL DDL for every service: backend/sql/<service>.sql
# plus a combined backend/sql/all_schemas.sql (paste into Supabase SQL Editor).
# Each service runs in its own process so metadata never collides.
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
PY="$ROOT/.venv/Scripts/python.exe"
OUTDIR="$ROOT/sql"
mkdir -p "$OUTDIR"
ALL="$OUTDIR/all_schemas.sql"

{
  echo "-- LARE platform — full schema DDL for Supabase PostgreSQL"
  echo "-- Schema-per-service. Idempotent (CREATE ... IF NOT EXISTS)."
  echo "-- Apply in the Supabase SQL Editor, or: bash migrate-supabase.sh"
  echo ""
} > "$ALL"

count=0
while IFS= read -r line; do
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$line" ] && continue
  case "$line" in \#*) continue;; esac
  name="$(echo "$line" | awk '{print $1}')"
  dir="$(echo "$line" | awk '{print $2}')"
  [ "$name" = "gateway" ] && continue           # proxy, no DB
  svcdir="$ROOT/services/$dir"
  [ -f "$svcdir/app/models.py" ] || continue
  # reserved-name mapping (matches bootstrap/run-all)
  sch="$name"
  case "$name" in auth|storage|realtime|graphql|vault|cron|net|extensions) sch="lare_$name";; esac
  out="$OUTDIR/$name.sql"
  if (cd "$svcdir" && GEN_SCHEMA="$sch" "$PY" "$ROOT/tools/gen_sql.py" > "$out" 2>/tmp/generr); then
    tables="$(grep -c 'CREATE TABLE' "$out")"
    echo "  ok    $name  -> sql/$name.sql (schema=$sch, $tables tables)"
    { echo ""; cat "$out"; } >> "$ALL"
    count=$((count+1))
  else
    echo "  FAIL  $name"; tail -3 /tmp/generr
  fi
done < "$ROOT/services.txt"

echo "---"
echo "generated $count service SQL files + $ALL"
echo "total tables: $(grep -c 'CREATE TABLE' "$ALL")"
