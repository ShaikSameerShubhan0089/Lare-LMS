"""Institution business logic."""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from lare_common.errors import Conflict, NotFound
from lare_common.security import new_id

from .models import (
    AcademicYear, Assignment, Branch, Cohort, College, ScheduleSlot, Semester,
)


def _d(v: str | None) -> date | None:
    return date.fromisoformat(v) if v else None


class InstitutionService:
    # ---------- colleges ----------
    def create_college(self, s: Session, data) -> College:
        c = College(
            id=new_id(), name=data.name, address=data.address, timezone=data.timezone,
            mou_ref=data.mou_ref, coordinator_user_id=data.coordinator_user_id,
            passing_threshold=data.passing_threshold, min_cohort_size=data.min_cohort_size,
        )
        s.add(c)
        s.flush()
        return c

    def get_college(self, s: Session, cid: str) -> College:
        c = s.get(College, cid)
        if not c:
            raise NotFound("College not found", code="college_not_found")
        return c

    def list_colleges(self, s: Session, limit: int) -> list[College]:
        return list(s.execute(select(College).limit(limit)).scalars().all())

    # ---------- branches ----------
    def add_branch(self, s: Session, cid: str, data) -> Branch:
        self.get_college(s, cid)
        dup = s.execute(
            select(Branch).where(Branch.college_id == cid, Branch.code == data.code)
        ).scalar_one_or_none()
        if dup:
            raise Conflict("Branch code already exists", code="branch_exists")
        b = Branch(id=new_id(), college_id=cid, name=data.name, code=data.code,
                   category=data.category)
        s.add(b)
        s.flush()
        return b

    def list_branches(self, s: Session, cid: str) -> list[Branch]:
        return list(
            s.execute(select(Branch).where(Branch.college_id == cid)).scalars().all()
        )

    # ---------- calendar ----------
    def add_academic_year(self, s: Session, cid: str, data) -> AcademicYear:
        self.get_college(s, cid)
        ay = AcademicYear(id=new_id(), college_id=cid, year_no=data.year_no,
                          start=_d(data.start), end=_d(data.end))
        s.add(ay)
        s.flush()
        for sem in data.semesters:
            s.add(Semester(id=new_id(), academic_year_id=ay.id, type=sem.type,
                           start=_d(sem.start), end=_d(sem.end)))
        s.flush()
        return ay

    def list_calendar(self, s: Session, cid: str) -> list[dict]:
        years = s.execute(
            select(AcademicYear).where(AcademicYear.college_id == cid)
        ).scalars().all()
        out = []
        for y in years:
            sems = s.execute(
                select(Semester).where(Semester.academic_year_id == y.id)
            ).scalars().all()
            out.append({
                "id": y.id, "year_no": y.year_no,
                "start": y.start.isoformat() if y.start else None,
                "end": y.end.isoformat() if y.end else None,
                "semesters": [
                    {"id": m.id, "type": m.type,
                     "start": m.start.isoformat() if m.start else None,
                     "end": m.end.isoformat() if m.end else None}
                    for m in sems
                ],
            })
        return out

    # ---------- cohorts ----------
    def add_cohort(self, s: Session, cid: str, data) -> Cohort:
        self.get_college(s, cid)
        if not s.get(Branch, data.branch_id):
            raise NotFound("Branch not found", code="branch_not_found")
        co = Cohort(id=new_id(), college_id=cid, branch_id=data.branch_id,
                    academic_year_id=data.academic_year_id, section=data.section,
                    year_no=data.year_no, size=data.size)
        s.add(co)
        s.flush()
        return co

    def list_cohorts(self, s: Session, cid: str) -> list[Cohort]:
        return list(
            s.execute(select(Cohort).where(Cohort.college_id == cid)).scalars().all()
        )

    # ---------- schedule ----------
    def add_slot(self, s: Session, cid: str, data) -> ScheduleSlot:
        self.get_college(s, cid)
        # Overlap guard: one branch cannot occupy two slots in the same
        # semester+week (one-week-per-branch rotational rule).
        dup = s.execute(
            select(ScheduleSlot).where(
                ScheduleSlot.semester_id == data.semester_id,
                ScheduleSlot.branch_id == data.branch_id,
                ScheduleSlot.week_no == data.week_no,
            )
        ).scalar_one_or_none()
        if dup:
            raise Conflict("Slot already exists for this branch/week", code="slot_overlap")
        slot = ScheduleSlot(id=new_id(), semester_id=data.semester_id,
                            branch_id=data.branch_id, week_no=data.week_no,
                            module_ref=data.module_ref, start=_d(data.start),
                            end=_d(data.end), trainer_user_id=data.trainer_user_id)
        s.add(slot)
        s.flush()
        return slot

    def list_schedule(self, s: Session, cid: str) -> list[ScheduleSlot]:
        # slots joined via semester->academic_year->college
        rows = s.execute(
            select(ScheduleSlot)
            .join(Semester, Semester.id == ScheduleSlot.semester_id)
            .join(AcademicYear, AcademicYear.id == Semester.academic_year_id)
            .where(AcademicYear.college_id == cid)
        ).scalars().all()
        return list(rows)

    # ---------- assignments & config ----------
    def assign(self, s: Session, cid: str, data) -> Assignment:
        self.get_college(s, cid)
        a = Assignment(id=new_id(), college_id=cid, user_id=data.user_id,
                       role=data.role, scope=data.scope)
        s.add(a)
        s.flush()
        return a

    def update_config(self, s: Session, cid: str, data) -> College:
        c = self.get_college(s, cid)
        c.passing_threshold = data.passing_threshold
        c.min_cohort_size = data.min_cohort_size
        return c

    # ---------- serializers ----------
    @staticmethod
    def college_out(c: College) -> dict:
        return {"id": c.id, "name": c.name, "address": c.address, "timezone": c.timezone,
                "mou_ref": c.mou_ref, "status": c.status,
                "coordinator_user_id": c.coordinator_user_id,
                "passing_threshold": c.passing_threshold, "min_cohort_size": c.min_cohort_size}

    @staticmethod
    def branch_out(b: Branch) -> dict:
        return {"id": b.id, "college_id": b.college_id, "name": b.name,
                "code": b.code, "category": b.category}

    @staticmethod
    def cohort_out(c: Cohort) -> dict:
        return {"id": c.id, "college_id": c.college_id, "branch_id": c.branch_id,
                "academic_year_id": c.academic_year_id, "section": c.section,
                "year_no": c.year_no, "size": c.size}

    @staticmethod
    def slot_out(sl: ScheduleSlot) -> dict:
        return {"id": sl.id, "semester_id": sl.semester_id, "branch_id": sl.branch_id,
                "week_no": sl.week_no, "module_ref": sl.module_ref,
                "start": sl.start.isoformat() if sl.start else None,
                "end": sl.end.isoformat() if sl.end else None,
                "trainer_user_id": sl.trainer_user_id}
