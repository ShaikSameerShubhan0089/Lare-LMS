#!/usr/bin/env bash
# Stop everything run-all.sh started.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$ROOT/.run/pids" ]]; then
  while read -r name pid; do
    [[ -n "${pid:-}" ]] && kill "$pid" 2>/dev/null && echo "  stopped $name ($pid)" || true
  done < "$ROOT/.run/pids"
  : > "$ROOT/.run/pids"
else
  # Fallback: kill any service process.
  pkill -f "manage.py serve" && echo "  killed all manage.py serve processes" || echo "  nothing running"
fi
