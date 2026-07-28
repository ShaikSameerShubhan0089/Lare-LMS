"""Certification subscribes to `year.completed` from Progress and auto-issues the
matching year certificate (idempotent per learner+year). On a fresh issue it
publishes `certificate.issued`, which fans out to Notification / Analytics /
Audit."""
from __future__ import annotations

import logging
from types import SimpleNamespace

log = logging.getLogger("lare-certification")


def register_handlers(bus, db, svc) -> None:
    def on_year_completed(payload, event):
        p = payload or {}
        if p.get("criteria_met") is False:
            return
        learner_id, year_no = p.get("learner_id"), p.get("year_no")
        if not (learner_id and year_no):
            return
        data = SimpleNamespace(
            learner_id=learner_id, year_no=int(year_no),
            ppo_tag=bool(p.get("ppo_tag", False)),
            holder_name=p.get("holder_name"),
        )
        with db.session() as s:
            res = svc.issue(s, data)
        if res.get("new"):
            log.info("auto-issued %s for %s", res.get("cert_no"), learner_id)
            bus.publish("certificate.issued", {
                "learner_id": learner_id, "year_no": int(year_no),
                "cert_no": res.get("cert_no"), "certificate": res.get("certificate"),
                "college_id": p.get("college_id"),
            })

    bus.on("year.completed", on_year_completed)
