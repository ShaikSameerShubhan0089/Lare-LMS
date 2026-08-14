"""AI Tutor: grounded chat, study plans, stream advice.

The model is reached only through the governed AI Orchestration service
(east-west), so all model access stays audited and prompt-restricted. If
Orchestration is unreachable, the tutor degrades to a local stub reply so the
UX never hard-fails."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from lare_common.security import new_id
from lare_common.service_client import ServiceClient

from .models import TutorMessage, TutorSession

_AI = ServiceClient("lms-tutor", default_roles=["trainer"], timeout=30)


def _ai_complete(prompt_key: str, variables: dict, *, actor_id: str,
                 want_json: bool = False, history=None, json_fallback=None):
    """Call the governed AI Orchestration egress; degrade gracefully."""
    body = {"prompt_key": prompt_key, "variables": variables, "purpose": "tutor",
            "want_json": want_json, "history": history or [],
            "json_fallback": json_fallback}
    try:
        resp = _AI.post("platform-ai", "/ai/v1/complete", body, user_id=actor_id)
        return (resp or {}).get("data") or {}
    except Exception:  # noqa: BLE001
        return {"mode": "offline", "model": "none",
                "output": json_fallback if want_json else
                "[Tutor is offline right now] Keep practising your weak areas and "
                "revisit your scorecard — I'll have detailed guidance once the AI "
                "service is reachable."}


class TutorService:
    # ---------- sessions ----------
    def sessions(self, s: Session, learner_id: str) -> list[dict]:
        rows = s.execute(
            select(TutorSession).where(TutorSession.learner_id == learner_id)
            .order_by(TutorSession.created_at.desc())
        ).scalars().all()
        return [{"id": r.id, "title": r.title, "created_at": r.created_at.isoformat()}
                for r in rows]

    def messages(self, s: Session, session_id: str) -> list[dict]:
        rows = s.execute(
            select(TutorMessage).where(TutorMessage.session_id == session_id)
            .order_by(TutorMessage.created_at)
        ).scalars().all()
        return [{"role": m.role, "content": m.content,
                 "created_at": m.created_at.isoformat()} for m in rows]

    def _history(self, s: Session, session_id: str, limit: int = 10) -> list[dict]:
        rows = s.execute(
            select(TutorMessage).where(TutorMessage.session_id == session_id)
            .order_by(TutorMessage.created_at.desc()).limit(limit)
        ).scalars().all()
        return [{"role": m.role, "content": m.content} for m in reversed(rows)]

    # ---------- chat ----------
    def chat(self, s: Session, learner_id: str, session_id: str | None,
             message: str, context: str = "") -> dict:
        if session_id:
            sess = s.get(TutorSession, session_id)
            if not sess or sess.learner_id != learner_id:
                session_id = None
        if not session_id:
            sess = TutorSession(id=new_id(), learner_id=learner_id,
                                title=message[:60] or "New chat")
            s.add(sess)
            s.flush()
            session_id = sess.id

        history = self._history(s, session_id)
        s.add(TutorMessage(id=new_id(), session_id=session_id, role="user", content=message))
        s.flush()

        data = _ai_complete("tutor_chat", {"context": context, "question": message},
                            actor_id=learner_id, history=history)
        reply = data.get("output") or "..."
        if isinstance(reply, dict):
            reply = str(reply)
        s.add(TutorMessage(id=new_id(), session_id=session_id, role="assistant", content=reply))
        s.flush()
        return {"session_id": session_id, "reply": reply,
                "mode": data.get("mode"), "model": data.get("model")}

    # ---------- structured helpers ----------
    def study_plan(self, s: Session, learner_id: str, variables: dict) -> dict:
        fallback = {"summary": "Focus on your weakest scorecard dimensions this month.",
                    "weeks": [{"week": 1, "focus": "Fundamentals",
                               "tasks": ["Daily 5 aptitude Qs", "2 DSA problems"]}]}
        data = _ai_complete("study_plan", variables, actor_id=learner_id,
                            want_json=True, json_fallback=fallback)
        return {"plan": data.get("output"), "mode": data.get("mode")}

    def stream_advice(self, s: Session, learner_id: str, variables: dict) -> dict:
        fallback = {"stream": "Full-Stack", "rationale": "Balanced coding + project scores.",
                    "next_steps": ["Build a portfolio project", "Learn a backend framework"]}
        data = _ai_complete("stream_advice", variables, actor_id=learner_id,
                            want_json=True, json_fallback=fallback)
        return {"advice": data.get("output"), "mode": data.get("mode")}
