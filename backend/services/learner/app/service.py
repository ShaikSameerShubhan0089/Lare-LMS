"""Learner business logic."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from lare_common.errors import Conflict, NotFound
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

    def list(self, s: Session, college_id: str | None, limit: int) -> list[Learner]:
        q = select(Learner)
        if college_id:
            q = q.where(Learner.college_id == college_id)
        return list(s.execute(q.limit(limit)).scalars().all())

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
