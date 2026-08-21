"""Learner business logic."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from lare_common.errors import Conflict, Forbidden, NotFound
from lare_common.security import new_id

from .models import (
    Enrollment, ImportJob, Learner, Project, Skill, StreamSelection,
)


def _utcnow():
    return datetime.now(tz=timezone.utc)


class LearnerService:
    def create(self, s: Session, data) -> Learner:
        dup = s.execute(
            select(Learner).where(
                Learner.college_id == data.college_id, Learner.roll_no == data.roll_no
            )
        ).scalar_one_or_none()
        if dup:
            raise Conflict("Roll number already exists in this college", code="roll_exists")
        lr = Learner(
            id=new_id(), user_id=data.user_id, college_id=data.college_id,
            cohort_id=data.cohort_id, branch_id=data.branch_id, roll_no=data.roll_no,
            full_name=data.full_name, email=data.email, cgpa=data.cgpa, year_no=data.year_no,
        )
        s.add(lr)
        s.flush()
        s.add(Enrollment(id=new_id(), learner_id=lr.id, year_no=data.year_no))
        s.flush()
        return lr

    def get(self, s: Session, lid: str) -> Learner:
        lr = s.get(Learner, lid)
        if not lr:
            raise NotFound("Learner not found", code="learner_not_found")
        return lr

    def list(self, s: Session, college_id: str | None, limit: int,
             scope=None) -> list[Learner]:
        q = select(Learner)
        if college_id:
            q = q.where(Learner.college_id == college_id)
        # Data-scope isolation: a caller only ever sees learners inside their
        # slice of the hierarchy (platform sees all). Enforced at the query.
        if scope is not None:
            q = scope.apply(q, college_col=Learner.college_id,
                            branch_col=Learner.branch_id,
                            cohort_col=Learner.cohort_id,
                            user_col=Learner.user_id)
        return list(s.execute(q.limit(limit)).scalars().all())

    # ---------- hierarchical analytics (Platform → College → Branch → Section → Student) ----------
    # A learner is "at risk" if their CGPA is on record and below 6.0, or their
    # enrolment is paused. Honest signal from real roster data — no fabrication.
    _AT_RISK = ((Learner.cgpa.is_not(None)) & (Learner.cgpa < 6.0)) | (Learner.status == "paused")

    _DRILL = {
        # level being viewed → (filter column for parent_id, grouping column for children, child level)
        "platform": (None, Learner.college_id, "college"),
        "college": (Learner.college_id, Learner.branch_id, "branch"),
        "branch": (Learner.branch_id, Learner.cohort_id, "section"),
        "section": (Learner.cohort_id, None, "student"),
    }

    def rollup(self, s: Session, scope, level: str, parent_id: str | None) -> dict:
        """Aggregated readiness for one node of the hierarchy plus a breakdown of
        its children. Scope-enforced: a caller only ever drills within their own
        slice, and the parent they open must be inside it."""
        if level not in self._DRILL:
            raise Conflict("Unknown hierarchy level", code="bad_level")
        parent_col, group_col, child_level = self._DRILL[level]

        if parent_col is not None and not parent_id:
            raise Conflict("parent_id is required at this level", code="parent_required")
        # Guard: the node being opened must be visible to the caller.
        if parent_id and scope is not None:
            ok = {
                "college": scope.can_see(college_id=parent_id),
                "branch": scope.can_see(branch_id=parent_id) or scope.level in ("platform", "college"),
                "section": scope.can_see(cohort_id=parent_id) or scope.level in ("platform", "college", "branch"),
            }.get(level, True)
            if not ok:
                raise Forbidden("Outside your scope")

        def scoped(stmt):
            base = stmt
            if parent_col is not None:
                base = base.where(parent_col == parent_id)
            if scope is not None:
                base = scope.apply(base, college_col=Learner.college_id,
                                   branch_col=Learner.branch_id,
                                   cohort_col=Learner.cohort_id, user_col=Learner.user_id)
            return base

        agg = (func.count(Learner.id),
               func.sum(case((Learner.verified.is_(True), 1), else_=0)),
               func.avg(Learner.cgpa),
               func.sum(case((self._AT_RISK, 1), else_=0)))

        # This node's totals
        total, verified, avg_cgpa, at_risk = s.execute(scoped(select(*agg))).one()
        summary = {
            "level": level, "parent_id": parent_id,
            "learners": int(total or 0), "verified": int(verified or 0),
            "avg_cgpa": round(float(avg_cgpa), 2) if avg_cgpa is not None else None,
            "at_risk": int(at_risk or 0),
        }

        # Real distributions for this node's population (no fabrication).
        # Status breakdown (active / paused / alumni …).
        summary["status_breakdown"] = {
            (st or "unknown"): int(n) for st, n in s.execute(
                scoped(select(Learner.status, func.count(Learner.id))).group_by(Learner.status)
            ).all()
        }
        # Year-of-study distribution.
        summary["year_distribution"] = {
            str(int(yr or 0)): int(n) for yr, n in s.execute(
                scoped(select(Learner.year_no, func.count(Learner.id))).group_by(Learner.year_no)
            ).all()
        }
        # CGPA bands (5 buckets + unknown) for a distribution histogram.
        band = case(
            (Learner.cgpa.is_(None), "unknown"),
            (Learner.cgpa < 6.0, "<6"),
            (Learner.cgpa < 7.0, "6-7"),
            (Learner.cgpa < 8.0, "7-8"),
            (Learner.cgpa < 9.0, "8-9"),
            else_="9-10",
        )
        summary["cgpa_bands"] = {
            b: int(n) for b, n in s.execute(
                scoped(select(band.label("b"), func.count(Learner.id))).group_by("b")
            ).all()
        }

        # Children breakdown (or the student leaf list)
        if group_col is None:  # section → list students
            rows = s.execute(scoped(select(Learner))).scalars().all()
            summary["child_level"] = "student"
            summary["children"] = [{
                "id": l.id, "name": l.full_name or l.roll_no, "roll_no": l.roll_no,
                "cgpa": l.cgpa, "verified": l.verified, "status": l.status,
                "at_risk": (l.cgpa is not None and l.cgpa < 6.0) or l.status == "paused",
            } for l in rows]
            return summary

        rows = s.execute(
            scoped(select(group_col, *agg)).where(group_col.is_not(None)).group_by(group_col)
        ).all()
        summary["child_level"] = child_level
        summary["children"] = [{
            "id": gid, "learners": int(cnt or 0), "verified": int(vf or 0),
            "avg_cgpa": round(float(avg), 2) if avg is not None else None,
            "at_risk": int(ar or 0),
        } for gid, cnt, vf, avg, ar in rows]
        return summary

    def bulk_import(self, s: Session, data) -> dict:
        existing = {
            r for r in s.execute(
                select(Learner.roll_no).where(Learner.college_id == data.college_id)
            ).scalars().all()
        }
        seen: set[str] = set()
        valid, duplicates, invalid = [], [], []
        for row in data.rows:
            if not row.roll_no:
                invalid.append({"row": row.model_dump(), "reason": "missing roll_no"})
            elif row.roll_no in existing or row.roll_no in seen:
                duplicates.append(row.roll_no)
            else:
                seen.add(row.roll_no)
                valid.append(row)

        summary = {
            "total": len(data.rows), "valid": len(valid),
            "duplicates": len(duplicates), "invalid": len(invalid),
            "duplicate_rolls": duplicates[:50], "invalid_rows": invalid[:50],
        }

        if data.commit and valid:
            for row in valid:
                lr = Learner(
                    id=new_id(), college_id=data.college_id, roll_no=row.roll_no,
                    full_name=row.full_name, email=row.email, branch_id=row.branch_id,
                    cgpa=row.cgpa,
                )
                s.add(lr)
                s.flush()
                s.add(Enrollment(id=new_id(), learner_id=lr.id, year_no=1))
            summary["committed"] = len(valid)

        job = ImportJob(
            id=new_id(), college_id=data.college_id,
            status="committed" if data.commit else "previewed", summary=summary,
        )
        s.add(job)
        s.flush()
        return {"job_id": job.id, "status": job.status, **summary}

    def verify(self, s: Session, lid: str) -> Learner:
        lr = self.get(s, lid)
        lr.verified = True
        return lr

    def set_stream(self, s: Session, lid: str, data) -> StreamSelection:
        self.get(s, lid)
        sel = s.get(StreamSelection, lid)
        if sel is None:
            sel = StreamSelection(learner_id=lid)
            s.add(sel)
        sel.stream = data.stream
        sel.rationale = data.rationale
        sel.mentor_user_id = data.mentor_user_id
        sel.decided_at = _utcnow()
        s.flush()
        return sel

    def get_stream(self, s: Session, lid: str) -> StreamSelection | None:
        self.get(s, lid)
        return s.get(StreamSelection, lid)

    def add_project(self, s: Session, lid: str, data) -> Project:
        self.get(s, lid)
        p = Project(id=new_id(), learner_id=lid, title=data.title,
                    description=data.description, repo_url=data.repo_url)
        s.add(p)
        s.flush()
        return p

    def list_projects(self, s: Session, lid: str) -> list[Project]:
        return list(
            s.execute(select(Project).where(Project.learner_id == lid)).scalars().all()
        )

    def promote(self, s: Session, lid: str, data) -> Learner:
        lr = self.get(s, lid)
        lr.year_no = data.year_no
        s.add(Enrollment(id=new_id(), learner_id=lid, year_no=data.year_no,
                         academic_year_id=data.academic_year_id))
        s.flush()
        return lr

    def profile(self, s: Session, lid: str) -> dict:
        lr = self.get(s, lid)
        sel = s.get(StreamSelection, lid)
        skills = s.execute(select(Skill).where(Skill.learner_id == lid)).scalars().all()
        projects = self.list_projects(s, lid)
        return {
            **self.out(lr),
            "stream": None if not sel else {
                "stream": sel.stream, "rationale": sel.rationale,
                "mentor_user_id": sel.mentor_user_id,
            },
            "skills": [{"skill": sk.skill, "level": sk.level} for sk in skills],
            "projects": [self.project_out(p) for p in projects],
        }

    @staticmethod
    def out(lr: Learner) -> dict:
        return {"id": lr.id, "user_id": lr.user_id, "college_id": lr.college_id,
                "cohort_id": lr.cohort_id, "branch_id": lr.branch_id, "roll_no": lr.roll_no,
                "full_name": lr.full_name, "email": lr.email, "cgpa": lr.cgpa,
                "status": lr.status, "verified": lr.verified, "year_no": lr.year_no}

    @staticmethod
    def project_out(p: Project) -> dict:
        return {"id": p.id, "title": p.title, "description": p.description,
                "repo_url": p.repo_url}
