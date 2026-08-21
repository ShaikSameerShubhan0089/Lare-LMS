"""Gamification logic: XP, levels, badges, streaks, leaderboards.

Awarding is server-side only and idempotent per source_event_id (GM-8): clients
never self-award. Levels use a simple escalating curve. Streaks are timezone-day
based with a one-day grace via freezes.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from lare_common.errors import Conflict, NotFound
from lare_common.security import new_id

from .models import Badge, LearnerBadge, LevelState, Streak, XPEntry

# Cumulative XP required to *reach* each level (index = level-1).
# Level N threshold = 100 * N*(N-1)/2 -> 0,100,300,600,1000,1500...
def level_for_xp(total_xp: int) -> int:
    lvl = 1
    while 50 * lvl * (lvl + 1) <= total_xp:  # threshold to reach level lvl+1
        lvl += 1
    return lvl


def next_level_threshold(level: int) -> int:
    return 50 * level * (level + 1)


class GamificationService:
    def _today(self) -> date:
        return datetime.now(tz=timezone.utc).date()

    # ---------- XP / levels ----------
    def award(self, s: Session, data) -> dict:
        # Idempotent: same source_event_id never double-awards.
        if data.source_event_id:
            dup = s.execute(
                select(XPEntry).where(
                    XPEntry.learner_id == data.learner_id,
                    XPEntry.source_event_id == data.source_event_id,
                )
            ).scalar_one_or_none()
            if dup:
                state = self._state(s, data.learner_id)
                return {**self._state_out(state), "awarded": 0, "idempotent": True}

        s.add(XPEntry(id=new_id(), learner_id=data.learner_id, action=data.action,
                      points=data.points, source_event_id=data.source_event_id))
        state = self._state(s, data.learner_id, create=True)
        prev_level = state.level
        state.total_xp += data.points
        state.level = level_for_xp(state.total_xp)
        if data.display_name:
            state.display_name = data.display_name
        s.flush()
        return {**self._state_out(state), "awarded": data.points,
                "leveled_up": state.level > prev_level}

    def _state(self, s: Session, learner_id: str, create: bool = False) -> LevelState:
        st = s.get(LevelState, learner_id)
        if st is None:
            if not create:
                raise NotFound("No gamification state", code="no_state")
            st = LevelState(learner_id=learner_id, total_xp=0, level=1)
            s.add(st)
            s.flush()
        return st

    def game_state(self, s: Session, learner_id: str) -> dict:
        # A learner with no XP yet has no row; the fallback needs explicit
        # defaults (column defaults only apply on INSERT, so an unflushed object
        # would carry level=None and blow up in next_level_threshold).
        st = s.get(LevelState, learner_id) or LevelState(learner_id=learner_id, total_xp=0, level=1)
        badges = s.execute(
            select(LearnerBadge).where(LearnerBadge.learner_id == learner_id)
        ).scalars().all()
        streak = s.get(Streak, learner_id)
        return {
            **self._state_out(st),
            "badges": [b.badge_code for b in badges],
            "streak": {
                "current": streak.current if streak else 0,
                "longest": streak.longest if streak else 0,
            },
        }

    # ---------- streaks ----------
    def touch_activity(self, s: Session, learner_id: str, day: date) -> dict:
        st = s.get(Streak, learner_id)
        if st is None:
            st = Streak(learner_id=learner_id, current=1, longest=1, last_active_day=day)
            s.add(st)
            s.flush()
            return self._streak_out(st)
        if st.last_active_day == day:
            return self._streak_out(st)  # already counted today
        gap = (day - st.last_active_day).days if st.last_active_day else 999
        if gap == 1:
            st.current += 1
        elif gap == 2 and st.freezes > 0:
            st.freezes -= 1  # freeze covers one missed day
            st.current += 1
        else:
            st.current = 1
        st.longest = max(st.longest, st.current)
        st.last_active_day = day
        s.flush()
        return self._streak_out(st)

    # ---------- badges ----------
    def create_badge(self, s: Session, data) -> Badge:
        dup = s.execute(select(Badge).where(Badge.code == data.code)).scalar_one_or_none()
        if dup:
            raise Conflict("Badge code exists", code="badge_exists")
        b = Badge(id=new_id(), code=data.code, name=data.name,
                  description=data.description, icon=data.icon)
        s.add(b)
        s.flush()
        return b

    def grant_badge(self, s: Session, learner_id: str, code: str) -> dict:
        if not s.execute(select(Badge).where(Badge.code == code)).scalar_one_or_none():
            raise NotFound("Badge not defined", code="badge_not_found")
        exists = s.execute(
            select(LearnerBadge).where(
                LearnerBadge.learner_id == learner_id, LearnerBadge.badge_code == code)
        ).scalar_one_or_none()
        if exists:
            return {"learner_id": learner_id, "badge_code": code, "new": False}
        s.add(LearnerBadge(id=new_id(), learner_id=learner_id, badge_code=code))
        s.flush()
        return {"learner_id": learner_id, "badge_code": code, "new": True}

    # ---------- leaderboard ----------
    def leaderboard(self, s: Session, limit: int = 10) -> list[dict]:
        rows = s.execute(
            select(LevelState).order_by(desc(LevelState.total_xp)).limit(limit)
        ).scalars().all()
        return [
            {"rank": i + 1, "learner_id": r.learner_id,
             "display_name": r.display_name, "total_xp": r.total_xp, "level": r.level}
            for i, r in enumerate(rows)
        ]

    # ---------- serializers ----------
    @staticmethod
    def _state_out(st: LevelState) -> dict:
        nxt = next_level_threshold(st.level)
        return {"learner_id": st.learner_id, "total_xp": st.total_xp, "level": st.level,
                "next_level_at": nxt, "xp_to_next": max(0, nxt - st.total_xp)}

    @staticmethod
    def _streak_out(st: Streak) -> dict:
        return {"current": st.current, "longest": st.longest,
                "last_active_day": st.last_active_day.isoformat() if st.last_active_day else None}
