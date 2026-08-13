"""Evidence ledger domain logic — append, query, and deterministic roll-ups.

All roll-ups here are deterministic (confidence-weighted arithmetic, no LLM) so
they are reproducible and auditable. The recruit-ai service (later) only narrates
and frames these numbers; it never replaces them.
"""
from __future__ import annotations

from sqlalchemy import select

from lare_common.errors import NotFound

from .models import Evidence, EvidenceConflict

# Confidence weights for roll-ups: high-confidence evidence pulls the score more.
_CONF_W = {"high": 1.0, "medium": 0.7, "low": 0.4}


class EvidenceService:
    def __init__(self, conflict_delta: float = 25.0):
        self.conflict_delta = conflict_delta

    # ---------- append (INSERT-only) ----------
    def append(self, s, *, drive_id, candidate_id, competency_key, source_type,
               source_ref, signal, confidence, rationale, round_key, actor_id):
        row = Evidence(
            drive_id=drive_id, candidate_id=candidate_id,
            competency_key=(competency_key or "overall"),
            source_type=source_type, source_ref=source_ref,
            signal=float(signal), confidence=(confidence or "medium"),
            rationale=rationale, round_key=round_key, actor_id=actor_id,
        )
        s.add(row)
        s.flush()
        conflicts = self._detect(s, row)
        return {"evidence": self._dump(row),
                "conflicts": [self._dump_conflict(c) for c in conflicts]}

    def _detect(self, s, row):
        prior = s.scalars(select(Evidence).where(
            Evidence.drive_id == row.drive_id,
            Evidence.candidate_id == row.candidate_id,
            Evidence.competency_key == row.competency_key,
            Evidence.id != row.id,
        )).all()
        made = []
        for p in prior:
            delta = abs(p.signal - row.signal)
            if delta > self.conflict_delta:
                c = EvidenceConflict(
                    drive_id=row.drive_id, candidate_id=row.candidate_id,
                    competency_key=row.competency_key, evidence_a=p.id,
                    evidence_b=row.id, delta=round(delta, 1),
                )
                s.add(c)
                made.append(c)
        if made:
            s.flush()
        return made

    # ---------- query ----------
    def drive_ledger(self, s, drive_id, limit=500):
        rows = s.scalars(select(Evidence).where(Evidence.drive_id == drive_id)
                         .order_by(Evidence.created_at.desc()).limit(limit)).all()
        return [self._dump(r) for r in rows]

    def candidate(self, s, candidate_id, drive_id=None):
        q = select(Evidence).where(Evidence.candidate_id == candidate_id)
        if drive_id:
            q = q.where(Evidence.drive_id == drive_id)
        rows = s.scalars(q.order_by(Evidence.created_at.desc())).all()
        conflicts = []
        if drive_id:
            conflicts = s.scalars(select(EvidenceConflict).where(
                EvidenceConflict.candidate_id == candidate_id,
                EvidenceConflict.drive_id == drive_id,
                EvidenceConflict.status == "open",
            )).all()
        return {
            "evidence": [self._dump(r) for r in rows],
            "rollup": self._rollup(rows),
            "conflicts": [self._dump_conflict(c) for c in conflicts],
        }

    def _rollup(self, rows):
        by: dict[str, dict] = {}
        for r in rows:
            b = by.setdefault(r.competency_key, {"num": 0.0, "den": 0.0, "n": 0})
            w = _CONF_W.get(r.confidence, 0.7)
            b["num"] += r.signal * w
            b["den"] += w
            b["n"] += 1
        out = []
        for k, b in by.items():
            score = round(b["num"] / b["den"], 1) if b["den"] else 0.0
            out.append({"competency_key": k, "score": score, "evidence_count": b["n"]})
        out.sort(key=lambda x: x["competency_key"])
        return out

    def conflicts(self, s, drive_id):
        rows = s.scalars(select(EvidenceConflict).where(
            EvidenceConflict.drive_id == drive_id,
            EvidenceConflict.status == "open",
        ).order_by(EvidenceConflict.detected_at.desc())).all()
        return [self._dump_conflict(c) for c in rows]

    def resolve_conflict(self, s, conflict_id):
        c = s.get(EvidenceConflict, conflict_id)
        if not c:
            raise NotFound("Conflict not found")
        c.status = "resolved"
        s.flush()
        return self._dump_conflict(c)

    # ---------- serialisation ----------
    @staticmethod
    def _dump(r):
        return {
            "id": r.id, "drive_id": r.drive_id, "candidate_id": r.candidate_id,
            "competency_key": r.competency_key, "source_type": r.source_type,
            "source_ref": r.source_ref, "signal": r.signal, "confidence": r.confidence,
            "rationale": r.rationale, "round_key": r.round_key, "actor_id": r.actor_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }

    @staticmethod
    def _dump_conflict(c):
        return {
            "id": c.id, "drive_id": c.drive_id, "candidate_id": c.candidate_id,
            "competency_key": c.competency_key, "evidence_a": c.evidence_a,
            "evidence_b": c.evidence_b, "delta": c.delta, "status": c.status,
            "detected_at": c.detected_at.isoformat() if c.detected_at else None,
        }
