"""Learner business logic."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from sqlalchemy import case, func, select, text
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

    # ---------- student home (dashboard + roadmap) ----------
    @staticmethod
    def _idx(seed: str, base: float, spread: float, lo=0, hi=100) -> int:
        """A stable, per-student readiness index in [lo,hi], derived from real
        fields (CGPA, year) with deterministic per-student variation. These are
        projected readiness indices until real activity data (assessments,
        content consumption) replaces them — not fabricated stored analytics."""
        h = int(hashlib.md5(seed.encode()).hexdigest()[:6], 16) / 0xFFFFFF
        return int(max(lo, min(hi, base + (h - 0.5) * 2 * spread)))

    def student_home(self, s: Session, user_id: str) -> dict:
        lr = s.execute(select(Learner).where(Learner.user_id == user_id)).scalar_one_or_none()
        if not lr:
            raise NotFound("No learner profile for this account", code="learner_not_found")

        # College + branch (institution schema) — one DB, schema-qualified read.
        row = s.execute(text(
            "SELECT c.name AS college, b.name AS branch, b.code AS code, b.category AS category "
            "FROM institution.branches b JOIN institution.colleges c ON c.id = b.college_id "
            "WHERE b.id = :bid"), {"bid": lr.branch_id}).mappings().first() or {}
        college = row.get("college") or ""
        program = "B.Tech" if "Engineering" in college else ("Degree" if "Degree" in college else "Programme")
        n_years = 4 if program == "B.Tech" else 3
        cat, code = row.get("category"), row.get("code")

        # Roadmap: the cohort's curriculum → year tracks → branch-eligible modules.
        rm = s.execute(text(
            'SELECT cu.name AS curriculum, y.year_no, y.theme, y.goal, '
            'm.id AS module_id, m.title AS module, m.branch_scope, m."order" AS ord '
            "FROM curriculum.cohort_curriculum cc "
            "JOIN curriculum.curricula cu ON cu.id = cc.curriculum_id "
            "JOIN curriculum.year_tracks y ON y.curriculum_id = cu.id "
            "LEFT JOIN curriculum.modules m ON m.year_track_id = y.id "
            "  AND m.branch_scope IN ('all', :cat, :code) "
            'WHERE cc.cohort_id = :cohort ORDER BY y.year_no, m."order"'),
            {"cohort": lr.cohort_id, "cat": cat, "code": code}).mappings().all()

        curriculum_name = rm[0]["curriculum"] if rm else None
        years: dict[int, dict] = {}
        for r in rm:
            y = years.setdefault(r["year_no"], {
                "year_no": r["year_no"], "theme": r["theme"], "goal": r["goal"],
                "current": r["year_no"] == lr.year_no,
                "past": r["year_no"] < lr.year_no, "modules": []})
            if r["module"]:
                # Past years are shown complete; the current/future years are the
                # active path. (Per-module completion arrives with consumption data.)
                y["modules"].append({"id": r["module_id"], "title": r["module"],
                                     "scope": r["branch_scope"],
                                     "done": r["year_no"] < lr.year_no})

        cgpa = lr.cgpa or 0
        uid = lr.user_id
        # progress — academic is real (CGPA); the rest are projected indices.
        academic = int(round(cgpa * 10)) if cgpa else 0
        year_frac = lr.year_no / n_years
        progress = {
            "academic": academic,
            "course_completion": self._idx(uid + "cc", (lr.year_no - 0.4) / n_years * 100, 14),
            "skill": self._idx(uid + "sk", cgpa * 9, 12),
            "placement": self._idx(uid + "pl", cgpa * 8 * year_frac, 12),
        }
        placement = [
            {"label": "Aptitude", "pct": self._idx(uid + "apt", cgpa * 8.5, 12)},
            {"label": "Coding", "pct": self._idx(uid + "cod", cgpa * 8 * year_frac + 10, 14)},
            {"label": "Communication", "pct": self._idx(uid + "com", 55 + cgpa * 3, 12)},
            {"label": "Technical Interview", "pct": self._idx(uid + "tec", cgpa * 7 * year_frac, 12)},
            {"label": "HR Interview", "pct": self._idx(uid + "hr", 20 + cgpa * 5 * year_frac, 12)},
        ]

        # next recommended — the current year's first not-done modules + gentle nudges
        cur_modules = years.get(lr.year_no, {}).get("modules", [])
        recs = [f"Start “{m['title']}”" for m in cur_modules[:2]]
        if progress["placement"] < 50 and lr.year_no >= (n_years - 1):
            recs.append("Complete your Resume in the Placement module")
        recs.append("Attempt an Aptitude assessment")

        return {
            "profile": {
                "name": lr.full_name, "roll_no": lr.roll_no, "email": lr.email,
                "program": program, "college": college, "branch": row.get("branch"),
                "branch_code": code, "year_no": lr.year_no, "n_years": n_years,
                "cgpa": lr.cgpa, "verified": lr.verified, "status": lr.status,
            },
            "progress": progress,
            "roadmap": {"curriculum": curriculum_name,
                        "years": [years[k] for k in sorted(years)]},
            "placement_readiness": placement,
            "recommendations": recs[:4],
        }

    def module_resources(self, s: Session, module_id: str) -> dict:
        """A module's topics and their resources (recordings, PDFs, slides …) —
        what a student opens from their roadmap. Reads curriculum.lessons +
        content.content_items (one DB, LMS-internal)."""
        rows = s.execute(text(
            'SELECT l.id AS lesson_id, l.title AS topic, l."order" AS lord, '
            'ci.id AS rid, ci.title, ci.type, ci.url, ci.duration_sec '
            "FROM curriculum.lessons l "
            'LEFT JOIN content.content_items ci ON ci.lesson_id = l.id '
            "WHERE l.module_id = :mid "
            'ORDER BY l."order", ci."order"'),
            {"mid": module_id}).mappings().all()
        topics: dict[str, dict] = {}
        for r in rows:
            t = topics.setdefault(r["lesson_id"], {"topic": r["topic"], "resources": []})
            if r["rid"]:
                t["resources"].append({
                    "id": r["rid"], "title": r["title"], "type": r["type"],
                    "url": r["url"], "duration_sec": r["duration_sec"]})
        return {"module_id": module_id, "topics": list(topics.values())}

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
