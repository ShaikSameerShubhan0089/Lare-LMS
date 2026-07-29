#!/usr/bin/env bash
# Generate + install one systemd service per LARE process (gateway + 26 services),
# reading backend/services.txt. This is the CEO guide's Phase 15 ("Run as Service")
# done for all 27 processes: each gets its own unit with auto-restart, so they
# survive crashes and reboots. Run with sudo.
#
#   sudo ./deploy/install-systemd.sh
#
set -euo pipefail

# --- EDIT THESE to match your box ---------------------------------------------
APP_DIR="/home/ubuntu/larelms/Lare-LMS/backend"      # folder containing services.txt
VENV="/home/ubuntu/larelms/Lare-LMS/backend/venv"    # the venv with LARE deps installed
RUN_USER="ubuntu"
# ------------------------------------------------------------------------------

REGISTRY="$APP_DIR/services.txt"
[[ -f "$REGISTRY" ]] || { echo "services.txt not found at $REGISTRY — fix APP_DIR"; exit 1; }
[[ -x "$VENV/bin/python" ]] || { echo "python not found at $VENV/bin/python — fix VENV"; exit 1; }

reserved=" auth storage realtime graphql vault cron net extensions "
schema_for() { local n="${1//-/_}"; [[ "$reserved" == *" $n "* ]] && echo "lare_$n" || echo "$n"; }

units=""
while read -r name dir port; do
  [[ -z "${name:-}" || "$name" == \#* ]] && continue
  unit="/etc/systemd/system/lare-${name}.service"

  # init-db (create schema + tables) before the service starts — not for gateway.
  pre=""
  schema_line=""
  if [[ "$name" != "gateway" ]]; then
    schema="$(schema_for "$name")"
    schema_line="Environment=DB_SCHEMA=${schema}"
    pre="ExecStartPre=${VENV}/bin/python manage.py init-db"
  fi

  cat > "$unit" <<UNIT
[Unit]
Description=LARE ${name} service (:${port})
After=network.target
PartOf=lare.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}/services/${dir}
EnvironmentFile=${APP_DIR}/.env
Environment=SERVICE_NAME=${name}
Environment=PORT=${port}
${schema_line}
${pre}
ExecStart=${VENV}/bin/python manage.py serve
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

  units="$units lare-${name}.service"
  echo "  wrote lare-${name}.service (:${port})"
done < <(tr -d '\r' < "$REGISTRY")

# A target so you can start/stop/enable all 27 with one command.
cat > /etc/systemd/system/lare.target <<'TARGET'
[Unit]
Description=All LARE services
Wants=network-online.target

[Install]
WantedBy=multi-user.target
TARGET

systemctl daemon-reload
# Enable (boot-persistent) AND start every unit now — explicit names, no glob.
systemctl enable --now $units
systemctl enable lare.target
echo ""
echo "Installed + started $(echo $units | wc -w) units."
echo "Status:               systemctl is-active lare-gateway lare-auth"
echo "Restart all later:    sudo systemctl restart $units" | fold -sw 100
echo "Logs for one service: journalctl -u lare-exam -f"
