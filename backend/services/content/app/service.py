"""Content delivery business logic: items, gating, consumption, recommendations."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from lare_common.errors import NotFound
from lare_common.security import new_id

from .models import Consumption, ContentItem, Gate

_DIFF_ORDER = {"easy": 0, "medium": 1, "hard": 2}


class ContentService:
    def create(self, s: Session, data) -> ContentItem:
        item = ContentItem(
            id=new_id(), lesson_id=data.lesson_id, title=data.title, type=data.type,
            file_id=data.file_id, url=data.url, duration_sec=data.duration_sec,
            difficulty=data.difficulty, order=data.order, objectives=data.objectives,
        )
        s.add(item)
        s.flush()
        return item

    def get(self, s: Session, cid: str) -> ContentItem:
        item = s.get(ContentItem, cid)
        if not item:
            raise NotFound("Content not found", code="content_not_found")
        return item

    def list_for_lesson(self, s: Session, lesson_id: str) -> list[ContentItem]:
        return list(s.execute(
            select(ContentItem).where(ContentItem.lesson_id == lesson_id)
            .order_by(ContentItem.order)
        ).scalars().all())

    def add_gate(self, s: Session, cid: str, prereq: str) -> Gate:
        self.get(s, cid)
        g = Gate(id=new_id(), content_item_id=cid, rule_type="prereq_content",
                 rule_config={"content_item_id": prereq})
        s.add(g)
        s.flush()
        return g

    def _completed_set(self, s: Session, learner_id: str) -> set[str]:
        rows = s.execute(
            select(Consumption.content_item_id).where(
                Consumption.learner_id == learner_id,
                Consumption.status == "completed",
            )
        ).scalars().all()
        return set(rows)

    def _is_unlocked(self, s: Session, item: ContentItem, completed: set[str]) -> bool:
        gates = s.execute(
            select(Gate).where(Gate.content_item_id == item.id)
        ).scalars().all()
        for g in gates:
            prereq = (g.rule_config or {}).get("content_item_id")
            if prereq and prereq not in completed:
                return False
        return True

    def playlist(self, s: Session, learner_id: str, lesson_id: str | None) -> list[dict]:
        completed = self._completed_set(s, learner_id)
        cons = {
            c.content_item_id: c for c in s.execute(
                select(Consumption).where(Consumption.learner_id == learner_id)
            ).scalars().all()
        }
        q = select(ContentItem).order_by(ContentItem.order)
        if lesson_id:
            q = q.where(ContentItem.lesson_id == lesson_id)
        items = s.execute(q).scalars().all()
        out = []
        for it in items:
            c = cons.get(it.id)
            out.append({
                **self.out(it),
                "unlocked": self._is_unlocked(s, it, completed),
                "status": c.status if c else "not_started",
                "position_sec": c.position_sec if c else 0,
            })
        return out

    def progress(self, s: Session, cid: str, data) -> Consumption:
        self.get(s, cid)
        c = s.execute(
            select(Consumption).where(
                Consumption.learner_id == data.learner_id,
                Consumption.content_item_id == cid,
            )
        ).scalar_one_or_none()
        if c is None:
            c = Consumption(id=new_id(), learner_id=data.learner_id, content_item_id=cid)
            s.add(c)
        c.position_sec = data.position_sec
        if data.completed:
            c.status = "completed"
        s.flush()
        return c

    def recommend(self, s: Session, learner_id: str, limit: int = 5) -> list[dict]:
        """Rule-based next-best items: unlocked, not completed, easiest first.
        (AI recommendation via AI Orchestration is a later enhancement.)"""
        completed = self._completed_set(s, learner_id)
        items = s.execute(select(ContentItem)).scalars().all()
        candidates = []
        for it in items:
            if it.id in completed:
                continue
            if not self._is_unlocked(s, it, completed):
                continue
            candidates.append(it)
        candidates.sort(key=lambda x: (_DIFF_ORDER.get(x.difficulty, 1), x.order))
        return [
            {**self.out(it), "reason": "next unlocked item", "score": 1.0}
            for it in candidates[:limit]
        ]

    def play(self, s: Session, cid: str) -> dict:
        item = self.get(s, cid)
        # In production this returns a short-lived signed URL from the File
        # Service. Until that service exists, surface the reference.
        return {"id": item.id, "type": item.type,
                "url": item.url or f"file://{item.file_id}" if item.file_id else item.url,
                "expires_in": 3600}

    @staticmethod
    def out(it: ContentItem) -> dict:
        return {"id": it.id, "lesson_id": it.lesson_id, "title": it.title, "type": it.type,
                "duration_sec": it.duration_sec, "difficulty": it.difficulty,
                "order": it.order, "objectives": it.objectives}
