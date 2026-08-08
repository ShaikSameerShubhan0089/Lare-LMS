#!/usr/bin/env bash
# One-shot redeploy for the AWS box. Pulls the latest code, restarts every
# backend service (so new routes / notifications / email / any server code is
# actually loaded), rebuilds the SPA, and publishes it into the nginx web root.
#
#   cd ~/larelms/Lare-LMS
#   chmod +x redeploy.sh      # once
#   ./redeploy.sh             # full redeploy
#
# Flags (env vars):
#   WEB_ROOT=/var/www/lare   nginx `root` for the SPA (default shown)
#   NO_PULL=1                skip `git pull` (already pulled)
#   NO_DEPS=1                skip pip install + npm ci (deps unchanged -> faster)
#   BACKEND_ONLY=1           restart services only, skip the frontend build
#   FRONTEND_ONLY=1          build+publish SPA only, don't touch services
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/lare}"

cd "$ROOT"
if [[ "${NO_PULL:-0}" != "1" ]]; then
  echo "==> git pull"
  git pull --ff-only
fi

# --------------------------- backend ---------------------------------------
if [[ "${FRONTEND_ONLY:-0}" != "1" ]]; then
  cd "$ROOT/backend"
  if   [[ -f venv/bin/activate  ]]; then source venv/bin/activate
  elif [[ -f .venv/bin/activate ]]; then source .venv/bin/activate
  fi

  if [[ "${NO_DEPS:-0}" != "1" ]]; then
    echo "==> pip install (base + per-service requirements)"
    pip install -q -r requirements-base.txt || true
    for d in services/*/; do
      [[ -f "$d/requirements.txt" ]] && pip install -q -r "$d/requirements.txt" || true
    done
  fi

  echo "==> restart backend services (loads new code)"
  ./stop-all.sh || true
  pkill -f "manage.py serve" 2>/dev/null || true
  sleep 2
  ./run-all.sh
fi

# --------------------------- frontend --------------------------------------
if [[ "${BACKEND_ONLY:-0}" != "1" ]]; then
  cd "$ROOT/frontend"
  if [[ "${NO_DEPS:-0}" != "1" ]]; then
    echo "==> npm ci"
    npm ci
  fi
  echo "==> build SPA"
  npm run build
  echo "==> publish SPA to $WEB_ROOT"
  sudo rsync -a --delete "$ROOT/frontend/dist/" "$WEB_ROOT/"
  sudo systemctl daemon-reload 2>/dev/null || true
  sudo systemctl reload nginx
fi

# --------------------------- verify ----------------------------------------
echo ""
echo "==> redeploy complete"
if [[ "${BACKEND_ONLY:-0}" != "1" ]]; then
  echo "    SPA bundle : $(grep -o 'assets/index-[^\"]*\.js' "$WEB_ROOT/index.html" 2>/dev/null || echo '??')"
fi
if [[ "${FRONTEND_ONLY:-0}" != "1" ]]; then
  echo "    gateway    : $(curl -s http://127.0.0.1:8000/health 2>/dev/null || echo 'HEALTH CHECK FAILED')"
  echo "    services   : $(pgrep -fc 'manage.py serve' 2>/dev/null || echo 0) processes running"
fi
echo "    Now hard-refresh the browser (Ctrl+Shift+R)."
