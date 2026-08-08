#!/usr/bin/env bash
# Seed (or clean) 30 demo students across every service. Linux twin of
# seed-demo.ps1 for the AWS box (uses backend/venv, prod schema names, .env DB).
#
#   cd ~/larelms/Lare-LMS/backend
#   chmod +x seed-demo.sh
#   ./seed-demo.sh          # create all demo data
#   ./seed-demo.sh clean    # remove all demo data
#
# Login for all seeded students: student01@lare.dev .. student30@lare.dev / Lare@1234
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
PY="$ROOT/venv/bin/python"
[ -x "$PY" ] || PY="$ROOT/.venv/bin/python"
[ -x "$PY" ] || PY="python3"
MODE="${1:-seed}"

run() {   # svc  schema  script  [arg]
  local svc="$1" sch="$2" script="$3" arg="${4:-}"
  local dir="$ROOT/services/$svc"
  if [ ! -f "$dir/$script" ]; then echo "  skip $svc/$script (missing)"; return; fi
  echo "== $svc / $script (schema=$sch) =="
  ( cd "$dir" && DB_SCHEMA="$sch" PYTHONPATH="." "$PY" "$script" $arg )
}

if [ "$MODE" = "clean" ]; then
  run analytics    analytics    seed_demo.py clean
  run ai_tutor     ai_tutor     seed_demo.py clean
  run certification certification seed_demo.py clean
  run gamification gamification seed_demo.py clean
  run assessment   assessment   seed_demo.py clean
  run coding       coding       seed_demo.py clean
  run learner      learner      seed_demo.py clean
  run auth         lare_auth    seed_demo.py clean
  echo ""; echo "Demo data removed. (roster file .run/demo_students.json kept)"
  exit 0
fi

# 1. students + shared roster (writes backend/.run/demo_students.json)
run auth    lare_auth seed_demo.py
run learner learner   seed_demo.py
# 2. content banks the per-student seeds rely on
run coding     coding     seed_practice.py
run assessment assessment seed_worlds.py
run assessment assessment seed_careers.py
# 3. per-student data across all features
run coding       coding       seed_demo.py
run assessment   assessment   seed_demo.py
run gamification gamification seed_demo.py
run certification certification seed_demo.py
run ai_tutor     ai_tutor     seed_demo.py
run analytics    analytics    seed_demo.py

echo ""
echo "Seeded. Log in: student01@lare.dev .. student30@lare.dev  /  Lare@1234"
