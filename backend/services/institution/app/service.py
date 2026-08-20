"""Institution business logic."""
from __future__ import annotations

import secrets
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from lare_common.errors import BadRequest, Conflict, NotFound
from lare_common.security import new_id

from .models import (
    AcademicYear, AccessCode, AccessSession, Assignment, Branch, Cohort, College,
    ScheduleSlot, Semester,
)

# Access-session lifetime — the student must re-enter the Access ID after this.
ACCESS_SESSION_HOURS = 12
# Unambiguous alphabet for the random suffix (no O/0/I/1).
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


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

    def list_colleges(self, s: Session, limit: int, scope=None) -> list[College]:
        q = select(College)
        # Every non-platform user (Principal, Dean, TPO, Faculty…) is bound to a
        # college, so the colleges list is filtered to their college bindings —
        # the finer branch/section scope narrows the rows *within* a college
        # elsewhere, not which colleges are visible.
        if scope is not None and not scope.unrestricted:
            q = q.where(College.id.in_(scope.college_ids or []))
        return list(s.execute(q.limit(limit)).scalars().all())

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

    # ---------- Access Gate (codes + validation) ----------
    def _gen_code(self, s: Session, branch_code: str, year_no: int, section: str | None) -> str:
        """Build a readable, unique code like 'CSE3B-7KQ9'."""
        base = "".join(ch for ch in (branch_code or "GEN").upper() if ch.isalnum())[:5]
        seg = f"{base}{year_no}{(section or '').upper()}"
        for _ in range(20):
            suffix = "".join(secrets.choice(_ALPHABET) for _ in range(4))
            code = f"{seg}-{suffix}"
            if not s.execute(select(AccessCode.id).where(AccessCode.code == code)).first():
                return code
        raise Conflict("Could not generate a unique code", code="code_gen_failed")

    def create_access_code(self, s: Session, data, created_by: str | None) -> AccessCode:
        cohort = s.get(Cohort, data.cohort_id)
        if not cohort:
            raise NotFound("Cohort not found", code="cohort_not_found")
        branch = s.get(Branch, cohort.branch_id) if cohort.branch_id else None
        exp = None
        if data.expires_at:
            try:
                exp = datetime.fromisoformat(data.expires_at.replace("Z", "+00:00"))
            except ValueError as e:
                raise BadRequest("Invalid expires_at", code="bad_datetime") from e
        ac = AccessCode(
            id=new_id(),
            code=self._gen_code(s, branch.code if branch else "GEN", cohort.year_no, cohort.section),
            cohort_id=cohort.id, college_id=cohort.college_id, branch_id=cohort.branch_id,
            year_no=cohort.year_no, section=cohort.section, label=data.label,
            expires_at=exp, created_by=created_by,
        )
        s.add(ac)
        s.flush()
        return ac

    def list_access_codes(self, s: Session, cohort_id: str | None) -> list[AccessCode]:
        stmt = select(AccessCode).order_by(AccessCode.created_at.desc())
        if cohort_id:
            stmt = stmt.where(AccessCode.cohort_id == cohort_id)
        return list(s.execute(stmt).scalars().all())

    def set_access_status(self, s: Session, code_id: str, status: str) -> AccessCode:
        ac = s.get(AccessCode, code_id)
        if not ac:
            raise NotFound("Access code not found", code="code_not_found")
        ac.status = status
        s.flush()
        return ac

    def regenerate_access_code(self, s: Session, code_id: str) -> AccessCode:
        ac = s.get(AccessCode, code_id)
        if not ac:
            raise NotFound("Access code not found", code="code_not_found")
        branch = s.get(Branch, ac.branch_id) if ac.branch_id else None
        ac.code = self._gen_code(s, branch.code if branch else "", ac.year_no, ac.section)
        s.flush()
        return ac

    def validate_access(self, s: Session, code: str, user_id: str) -> dict:
        """Student presents the group code → resolve the cohort and open a
        short-lived access session bound to this user."""
        ac = s.execute(
            select(AccessCode).where(AccessCode.code == code.strip().upper())
        ).scalar_one_or_none()
        if not ac or ac.status != "active":
            raise NotFound("Invalid or inactive access code", code="invalid_access_code")
        if ac.expires_at and _as_utc(ac.expires_at) < _utcnow():
            raise BadRequest("This access code has expired", code="access_code_expired")
        cohort = s.get(Cohort, ac.cohort_id)
        college = s.get(College, ac.college_id) if ac.college_id else None
        branch = s.get(Branch, ac.branch_id) if ac.branch_id else None
        # refresh any prior session for this user (every login re-validates)
        for old in s.execute(select(AccessSession).where(AccessSession.user_id == user_id)).scalars().all():
            s.delete(old)
        sess = AccessSession(id=new_id(), user_id=user_id, cohort_id=ac.cohort_id,
                             code_id=ac.id, expires_at=_utcnow() + timedelta(hours=ACCESS_SESSION_HOURS))
        s.add(sess)
        ac.used_count += 1
        s.flush()
        return {
            "cohort_id": ac.cohort_id, "college_id": ac.college_id,
            "college_name": college.name if college else None,
            "branch_id": ac.branch_id, "branch_name": branch.name if branch else None,
            "branch_code": branch.code if branch else None,
            "year_no": ac.year_no, "section": ac.section,
            "label": ac.label, "expires_at": sess.expires_at.isoformat(),
        }

    def access_session(self, s: Session, user_id: str) -> dict | None:
        """Current validated access for this user, or None (→ show the gate)."""
        sess = s.execute(
            select(AccessSession).where(AccessSession.user_id == user_id)
            .order_by(AccessSession.created_at.desc())
        ).scalars().first()
        if not sess or _as_utc(sess.expires_at) < _utcnow():
            return None
        cohort = s.get(Cohort, sess.cohort_id)
        return {"cohort_id": sess.cohort_id, "year_no": cohort.year_no if cohort else None,
                "section": cohort.section if cohort else None,
                "expires_at": sess.expires_at.isoformat()}

    def clear_access_session(self, s: Session, user_id: str) -> None:
        for sess in s.execute(select(AccessSession).where(AccessSession.user_id == user_id)).scalars().all():
            s.delete(sess)

    @staticmethod
    def access_code_out(ac: AccessCode) -> dict:
        return {"id": ac.id, "code": ac.code, "cohort_id": ac.cohort_id,
                "college_id": ac.college_id, "branch_id": ac.branch_id,
                "year_no": ac.year_no, "section": ac.section, "label": ac.label,
                "status": ac.status, "used_count": ac.used_count,
                "expires_at": ac.expires_at.isoformat() if ac.expires_at else None,
                "created_at": ac.created_at.isoformat()}
