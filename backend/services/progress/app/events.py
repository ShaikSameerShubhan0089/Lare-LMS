"""Progress subscribes to scoring/engagement events and folds them into the
skill scorecard (running average per dimension) and module completion."""
from __future__ import annotations

from types import SimpleNamespace

# assessment category / skill tag -> scorecard dimension
_DIM = {
    "communication": "communication", "verbal": "communication", "english": "communication",
    "coding": "coding", "programming": "coding", "technical": "coding", "dsa": "coding",
    "aptitude": "aptitude", "quant": "aptitude", "reasoning": "aptitude",
    "project": "project", "capstone": "project",
}


def _dimension(tag) -> str:
    return _DIM.get(str(tag or "").lower(), "coding")


def register_handlers(bus, db, svc) -> None:
    def on_scored(payload, event):
        p = payload or {}
        learner_id = p.get("learner_id")
        if not learner_id:
            return
        data = SimpleNamespace(
            learner_id=learner_id,
            year_no=int(p.get("year_no", 2)),
            dimension=_dimension(p.get("skill") or p.get("category")),
            value=float(p.get("score", 0)),
            source="assessment",
            ref_id=p.get("assessment_id"),
        )
        with db.session() as s:
            svc.record_score(s, data)

    def on_content(payload, event):
        p = payload or {}
        if not (p.get("learner_id") and p.get("module_id")):
            return
        data = SimpleNamespace(
            learner_id=p["learner_id"], module_id=p["module_id"],
            completion_pct=float(p.get("completion_pct", 100)),
        )
        with db.session() as s:
            svc.set_module_progress(s, data)

    bus.on("assessment.scored", on_scored)
    bus.on("content.completed", on_content)
