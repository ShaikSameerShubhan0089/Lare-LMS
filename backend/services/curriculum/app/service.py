"""Curriculum business logic. Published versions are immutable (CU-6)."""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from lare_common.errors import Conflict, NotFound
from lare_common.security import new_id

from .models import (
    CohortCurriculum, Curriculum, ItemObjectiveMap, Lesson, Module, Objective,
    OutcomeCheck, YearTrack,
)


def _d(v: str | None) -> date | None:
    return date.fromisoformat(v) if v else None


class CurriculumService:
    # ---------- guards ----------
    def _editable(self, cur: Curriculum) -> None:
        if cur.status == "published":
            raise Conflict("Published curriculum is immutable; create a new version",
                           code="curriculum_published")

    def get_curriculum(self, s: Session, cid: str) -> Curriculum:
        cur = s.get(Curriculum, cid)
        if not cur:
            raise NotFound("Curriculum not found", code="curriculum_not_found")
        return cur

    def _year(self, s: Session, yid: str) -> YearTrack:
        y = s.get(YearTrack, yid)
        if not y:
            raise NotFound("Year track not found", code="year_not_found")
        return y

    def _module(self, s: Session, mid: str) -> Module:
        m = s.get(Module, mid)
        if not m:
            raise NotFound("Module not found", code="module_not_found")
        return m

    def _lesson(self, s: Session, lid: str) -> Lesson:
        l = s.get(Lesson, lid)
        if not l:
            raise NotFound("Lesson not found", code="lesson_not_found")
        return l

    def _curriculum_of_year(self, s: Session, y: YearTrack) -> Curriculum:
        return self.get_curriculum(s, y.curriculum_id)

    # ---------- create / edit ----------
    def create(self, s: Session, data) -> Curriculum:
        cur = Curriculum(id=new_id(), name=data.name)
        s.add(cur)
        s.flush()
        return cur

    def add_year(self, s: Session, cid: str, data) -> YearTrack:
        cur = self.get_curriculum(s, cid)
        self._editable(cur)
        dup = s.execute(
            select(YearTrack).where(
                YearTrack.curriculum_id == cid, YearTrack.year_no == data.year_no)
        ).scalar_one_or_none()
        if dup:
            raise Conflict("Year already defined", code="year_exists")
        y = YearTrack(id=new_id(), curriculum_id=cid, year_no=data.year_no,
                      theme=data.theme, goal=data.goal)
        s.add(y)
        s.flush()
        return y

    def add_module(self, s: Session, yid: str, data) -> Module:
        y = self._year(s, yid)
        self._editable(self._curriculum_of_year(s, y))
        m = Module(id=new_id(), year_track_id=yid, title=data.title, order=data.order,
                   branch_scope=data.branch_scope)
        s.add(m)
        s.flush()
        return m

    def add_lesson(self, s: Session, mid: str, data) -> Lesson:
        m = self._module(s, mid)
        y = self._year(s, m.year_track_id)
        self._editable(self._curriculum_of_year(s, y))
        l = Lesson(id=new_id(), module_id=mid, title=data.title, order=data.order,
                   content_ref=data.content_ref)
        s.add(l)
        s.flush()
        return l

    def add_objective(self, s: Session, lid: str, data) -> Objective:
        self._lesson(s, lid)
        o = Objective(id=new_id(), lesson_id=lid, statement=data.statement,
                      skill_tag=data.skill_tag)
        s.add(o)
        s.flush()
        return o

    def add_outcome_check(self, s: Session, yid: str, data) -> OutcomeCheck:
        self._year(s, yid)
        oc = OutcomeCheck(id=new_id(), year_track_id=yid, statement=data.statement,
                          criteria=data.criteria)
        s.add(oc)
        s.flush()
        return oc

    def publish(self, s: Session, cid: str) -> Curriculum:
        cur = self.get_curriculum(s, cid)
        if cur.status == "published":
            raise Conflict("Already published", code="already_published")
        if not cur.years:
            raise Conflict("Cannot publish an empty curriculum", code="empty_curriculum")
        cur.status = "published"
        return cur

    def map_cohort(self, s: Session, cid: str, data) -> CohortCurriculum:
        cur = self.get_curriculum(s, cid)
        if cur.status != "published":
            raise Conflict("Only published curricula can be mapped to a cohort",
                           code="not_published")
        cc = CohortCurriculum(id=new_id(), cohort_id=data.cohort_id, curriculum_id=cid,
                              effective_from=_d(data.effective_from))
        s.add(cc)
        s.flush()
        return cc

    def map_item(self, s: Session, oid: str, data) -> ItemObjectiveMap:
        if not s.get(Objective, oid):
            raise NotFound("Objective not found", code="objective_not_found")
        m = ItemObjectiveMap(id=new_id(), objective_id=oid, item_type=data.item_type,
                             item_id=data.item_id)
        s.add(m)
        s.flush()
        return m

    def objective_items(self, s: Session, oid: str) -> list[dict]:
        rows = s.execute(
            select(ItemObjectiveMap).where(ItemObjectiveMap.objective_id == oid)
        ).scalars().all()
        return [{"item_type": r.item_type, "item_id": r.item_id} for r in rows]

    # ---------- read ----------
    def tree(self, s: Session, cid: str) -> dict:
        cur = self.get_curriculum(s, cid)
        years = []
        for y in sorted(cur.years, key=lambda x: x.year_no):
            mods = s.execute(
                select(Module).where(Module.year_track_id == y.id).order_by(Module.order)
            ).scalars().all()
            year = {
                "id": y.id, "year_no": y.year_no, "theme": y.theme, "goal": y.goal,
                "outcome_checks": [
                    {"id": oc.id, "statement": oc.statement, "criteria": oc.criteria}
                    for oc in s.execute(
                        select(OutcomeCheck).where(OutcomeCheck.year_track_id == y.id)
                    ).scalars().all()
                ],
                "modules": [],
            }
            for m in mods:
                lessons = s.execute(
                    select(Lesson).where(Lesson.module_id == m.id).order_by(Lesson.order)
                ).scalars().all()
                mod = {"id": m.id, "title": m.title, "order": m.order,
                       "branch_scope": m.branch_scope, "lessons": []}
                for l in lessons:
                    objs = s.execute(
                        select(Objective).where(Objective.lesson_id == l.id)
                    ).scalars().all()
                    mod["lessons"].append({
                        "id": l.id, "title": l.title, "order": l.order,
                        "content_ref": l.content_ref,
                        "objectives": [
                            {"id": o.id, "statement": o.statement, "skill_tag": o.skill_tag}
                            for o in objs
                        ],
                    })
                year["modules"].append(mod)
            years.append(year)
        return {"id": cur.id, "name": cur.name, "version": cur.version,
                "status": cur.status, "years": years}

    @staticmethod
    def out(cur: Curriculum) -> dict:
        return {"id": cur.id, "name": cur.name, "version": cur.version, "status": cur.status}
