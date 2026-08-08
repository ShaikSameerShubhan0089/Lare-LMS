"""Scheduled AI-coach nudger. Triggers the assessment service to nudge every
learner whose study plan is due (not reminded in N days and not finished).

This is the "auto" in the persistent, auto-nudging coach: instead of the learner
pressing a button, a daily job reminds them. Run it from cron or a systemd timer.

    cd ~/larelms/Lare-LMS/backend/services/assessment
    PYTHONPATH=.:../.. ~/larelms/Lare-LMS/backend/venv/bin/python nudge_scheduler.py [days]

`days` (default 3) is the minimum gap between nudges for the same learner.

--- systemd timer (production) ---------------------------------------------
# /etc/systemd/system/lare-coach-nudge.service
#   [Service]
#   Type=oneshot
#   WorkingDirectory=/home/ubuntu/larelms/Lare-LMS/backend/services/assessment
#   Environment=PYTHONPATH=.:../..
#   ExecStart=/home/ubuntu/larelms/Lare-LMS/backend/venv/bin/python nudge_scheduler.py
#
# /etc/systemd/system/lare-coach-nudge.timer
#   [Timer]
#   OnCalendar=*-*-* 09:00:00      # every day at 09:00
#   Persistent=true
#   [Install]
#   WantedBy=timers.target
#
#   sudo systemctl enable --now lare-coach-nudge.timer

--- cron alternative -------------------------------------------------------
#   0 9 * * *  cd /path/to/backend/services/assessment && PYTHONPATH=.:../.. \
#              /path/to/venv/bin/python nudge_scheduler.py >> /var/log/lare-nudge.log 2>&1
"""
from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

load_dotenv()

from lare_common.service_client import ServiceClient  # noqa: E402

days = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.getenv("COACH_NUDGE_DAYS", "3"))


def main():
    client = ServiceClient("coach-nudger", default_roles=["company_admin"], timeout=30)
    try:
        res = client.post("lms-assessment",
                          "/lms/v1/assessments/coach/nudge-due",
                          {"days": days}, roles=["company_admin"])
    except Exception as exc:  # noqa: BLE001
        print("Nudge run failed:", exc)
        sys.exit(1)
    data = (res or {}).get("data") or res or {}
    print("Coach nudge run complete: {} due, {} nudged (gap: {}d).".format(
        data.get("due", "?"), data.get("nudged", "?"), days))


if __name__ == "__main__":
    main()
