#!/usr/bin/env bash
# LARE backend entrypoint. Reads backend/services.txt (the single source of
# truth for name/dir/port), initialises each service's schema, writes a
# supervisord program per service, then runs them all — the container twin of
# run-all.ps1. Env (DATABASE_URL, JWT secrets, API keys, REDIS_URL) is supplied
# by docker-compose's env_file and inherited by every child process.
set -euo pipefail

ROOT=/app/backend
REGISTRY="$ROOT/services.txt"
# Write to the default path so `supervisorctl` (no -c) finds the socket too.
CONF=/etc/supervisor/supervisord.conf

# Postgres/Supabase reserve these schema names, so run-all.ps1 prefixes them
# with "lare_". Mirror that exactly (only "auth" collides in our registry).
reserved=" auth storage realtime graphql vault cron net extensions "
schema_for() {
  local name="${1//-/_}"
  if [[ "$reserved" == *" $name "* ]]; then echo "lare_${name}"; else echo "$name"; fi
}

echo "[entrypoint] DATABASE_URL host: $(echo "${DATABASE_URL:-unset}" | sed -E 's#://[^@]*@#://***@#')"

# ---- 1. init-db for every service (idempotent; creates schema + tables) ------
if [[ "${SKIP_INIT:-0}" != "1" ]]; then
  while read -r name dir port; do
    [[ -z "${name:-}" || "$name" == \#* ]] && continue
    [[ "$name" == "gateway" ]] && continue   # gateway is stateless
    local_schema="$(schema_for "$name")"
    echo "[entrypoint] init-db $name (schema=$local_schema)"
    ( cd "$ROOT/services/$dir" \
      && DB_SCHEMA="$local_schema" SERVICE_NAME="$name" PORT="$port" \
         python manage.py init-db ) \
      || echo "[entrypoint] WARN: init-db failed for $name (continuing)"
  done < <(tr -d '\r' < "$REGISTRY")
fi

# ---- 2. generate one supervisord [program] per service -----------------------
mkdir -p /etc/supervisor /var/log/lare
cat > "$CONF" <<'HEADER'
[supervisord]
nodaemon=true
logfile=/dev/null
logfile_maxbytes=0

[unix_http_server]
file=/var/run/supervisor.sock
chmod=0700

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

[supervisorctl]
serverurl=unix:///var/run/supervisor.sock
HEADER

while read -r name dir port; do
  [[ -z "${name:-}" || "$name" == \#* ]] && continue
  extra_env=""
  if [[ "$name" != "gateway" ]]; then
    extra_env=",DB_SCHEMA=\"$(schema_for "$name")\""
  fi
  cat >> "$CONF" <<PROG

[program:$name]
command=python manage.py serve
directory=$ROOT/services/$dir
environment=PORT="$port",SERVICE_NAME="$name"$extra_env
autostart=true
autorestart=true
startsecs=3
stopwaitsecs=10
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
PROG
done < <(tr -d '\r' < "$REGISTRY")

echo "[entrypoint] launching supervisord (gateway + 26 services)"
exec supervisord -c "$CONF" -n
