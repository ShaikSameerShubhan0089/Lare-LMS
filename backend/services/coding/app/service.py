"""Coding assessment logic: problems, IDE sessions, run vs samples, submit vs
hidden cases, weighted scoring. Hidden expected outputs are never returned."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from lare_common.errors import Conflict, NotFound
from lare_common.security import new_id

from .executor import Executor
from .models import CodingSession, CodingSubmission, Problem


def _norm(s: str) -> str:
    return "\n".join(line.rstrip() for line in (s or "").strip().splitlines())


class CodingService:
    def __init__(self, executor: Executor, timeout_sec: int = 5):
        self.executor = executor
        self.timeout = timeout_sec

    # ---------- problems ----------
    def create_problem(self, s: Session, data) -> Problem:
        p = Problem(id=new_id(), title=data.title, statement=data.statement,
                    languages=data.languages, time_limit_sec=data.time_limit_sec,
                    sample_cases=[c.model_dump() for c in data.sample_cases],
                    hidden_cases=[c.model_dump() for c in data.hidden_cases],
                    max_score=data.max_score)
        s.add(p)
        s.flush()
        return p

    def get_problem(self, s: Session, pid: str) -> Problem:
        p = s.get(Problem, pid)
        if not p:
            raise NotFound("Problem not found", code="problem_not_found")
        return p

    # ---------- sessions ----------
    def open_session(self, s: Session, candidate_id: str, data) -> dict:
        p = self.get_problem(s, data.problem_id)
        cs = CodingSession(id=new_id(), problem_id=p.id, candidate_id=candidate_id,
                           exam_session_id=data.exam_session_id, language=data.language)
        s.add(cs)
        s.flush()
        return {"session_id": cs.id, "problem": self.problem_for_candidate(p),
                "language": cs.language}

    def _session(self, s: Session, sid: str, candidate_id: str) -> CodingSession:
        cs = s.get(CodingSession, sid)
        if not cs:
            raise NotFound("Coding session not found", code="coding_session_not_found")
        if cs.candidate_id != candidate_id:
            from lare_common.errors import Forbidden
            raise Forbidden("Not your session")
        return cs

    def save(self, s: Session, sid: str, candidate_id: str, code: str) -> dict:
        cs = self._session(s, sid, candidate_id)
        if cs.status != "open":
            raise Conflict("Session already submitted", code="already_submitted")
        cs.draft_code = code
        s.flush()
        return {"saved": True, "length": len(code)}

    # ---------- run / submit ----------
    def run_samples(self, s: Session, sid: str, candidate_id: str, code: str) -> dict:
        cs = self._session(s, sid, candidate_id)
        p = self.get_problem(s, cs.problem_id)
        results = []
        for case in p.sample_cases:
            r = self.executor.run(cs.language, code, case.get("input", ""),
                                  min(self.timeout, p.time_limit_sec),
                                  mem_mb=getattr(p, "memory_limit_mb", 256))
            passed = (not r.timed_out and r.exit_code == 0
                      and _norm(r.stdout) == _norm(case.get("expected", "")))
            results.append({
                "input": case.get("input", ""), "expected": case.get("expected", ""),
                "stdout": r.stdout, "stderr": r.stderr, "passed": passed,
                "time_ms": r.time_ms, "timed_out": r.timed_out,
                "compile_log": r.compile_log, "compile_failed": r.compile_failed,
            })
        return {"cases": results, "language": cs.language,
                "compile_failed": any(x["compile_failed"] for x in results),
                "passed": sum(1 for x in results if x["passed"]), "total": len(results)}

    def languages(self) -> dict:
        return {"languages": self.executor.language_versions()}

    def run_adhoc(self, language: str, code: str, cases: list, timeout: int = 5,
                  mem_mb: int = 256) -> dict:
        """Stateless run for exam coding questions: execute code against the
        supplied (visible) test cases and report pass/fail per case. No stored
        problem needed — the exam question carries its own sample cases."""
        results = []
        compile_failed = False
        compile_log = ""
        for case in cases[:20]:
            r = self.executor.run(language, code, case.get("input", ""),
                                  min(self.timeout, timeout), mem_mb=mem_mb)
            if r.compile_failed:
                compile_failed = True
                compile_log = r.compile_log
            passed = (not r.timed_out and r.exit_code == 0
                      and _norm(r.stdout) == _norm(case.get("expected", "")))
            results.append({
                "input": case.get("input", ""), "expected": case.get("expected", ""),
                "stdout": r.stdout, "stderr": r.stderr, "passed": passed,
                "time_ms": r.time_ms, "timed_out": r.timed_out,
            })
        return {"language": language, "compile_failed": compile_failed,
                "compile_log": compile_log, "cases": results,
                "passed": sum(1 for x in results if x["passed"]), "total": len(results)}

    def submit(self, s: Session, sid: str, candidate_id: str, code: str) -> dict:
        cs = self._session(s, sid, candidate_id)
        if cs.status != "open":
            raise Conflict("Session already submitted", code="already_submitted")
        p = self.get_problem(s, cs.problem_id)
        detail = []
        passed = 0
        for i, case in enumerate(p.hidden_cases):
            r = self.executor.run(cs.language, code, case.get("input", ""),
                                  min(self.timeout, p.time_limit_sec),
                                  mem_mb=getattr(p, "memory_limit_mb", 256))
            ok = (not r.timed_out and r.exit_code == 0
                  and _norm(r.stdout) == _norm(case.get("expected", "")))
            if ok:
                passed += 1
            # NOTE: no expected/stdout leaked for hidden cases.
            detail.append({"case": i + 1, "passed": ok, "timed_out": r.timed_out,
                           "time_ms": r.time_ms})
        total = len(p.hidden_cases)
        score = round(p.max_score * passed / total, 2) if total else 0.0
        cs.draft_code = code
        cs.status = "submitted"
        sub = CodingSubmission(id=new_id(), coding_session_id=sid, code=code, score=score,
                               cases_passed=passed, total_cases=total, detail=detail)
        s.add(sub)
        s.flush()
        return {"session_id": sid, "score": score, "cases_passed": passed,
                "total_cases": total, "detail": detail}

    def result(self, s: Session, sid: str) -> dict:
        sub = s.execute(
            select(CodingSubmission).where(CodingSubmission.coding_session_id == sid)
            .order_by(CodingSubmission.submitted_at.desc())
        ).scalars().first()
        if not sub:
            raise NotFound("No submission", code="no_submission")
        return {"session_id": sid, "score": sub.score, "cases_passed": sub.cases_passed,
                "total_cases": sub.total_cases, "detail": sub.detail}

    # ---------- serializers ----------
    @staticmethod
    def problem_for_candidate(p: Problem) -> dict:
        # Only sample cases are visible; hidden cases (and their count) withheld.
        return {"id": p.id, "title": p.title, "statement": p.statement,
                "languages": p.languages, "time_limit_sec": p.time_limit_sec,
                "sample_cases": p.sample_cases, "max_score": p.max_score}
