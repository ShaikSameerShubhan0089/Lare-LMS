"""HTTP layer for the Assessment Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import current_identity, require_roles
from lare_common.errors import BadRequest, Forbidden
from lare_common.responses import created, ok

from .schemas import (
    AssessmentIn, CareerIn, DrillAnswerIn, DrillStartIn, GradeIn, LessonIn,
    StartIn, SubmitIn, TeachRequestIn, TeachRespondIn, WorldAnswerIn, WorldIn,
)
from .service import AssessmentService

bp = Blueprint("assessment", __name__)

AUTHOR = ("super_admin", "company_admin", "trainer")
READ = ("super_admin", "company_admin", "college_admin", "trainer", "student")


def _svc() -> AssessmentService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


@bp.post("/lms/v1/assessments")
@require_roles(*AUTHOR)
def create():
    data = _parse(AssessmentIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().out(_svc().create(s, data)))


@bp.get("/lms/v1/assessments")
@require_roles(*READ)
def list_assessments():
    year = request.args.get("year_no")
    with _db().session() as s:
        rows = _svc().list(s, int(year) if year else None)
        return ok([_svc().list_out(s, a) for a in rows])


@bp.get("/lms/v1/assessments/summary")
@require_roles(*READ)
def summary():
    learner_id = request.args.get("learner_id")
    if not learner_id:
        raise BadRequest("learner_id is required", code="learner_id_required")
    with _db().session() as s:
        return ok(_svc().summary(s, learner_id))


STAFF_LMS = ("super_admin", "company_admin", "college_admin", "trainer")


@bp.get("/lms/v1/assessments/twin/<learner_id>")
@require_roles(*READ)
def twin(learner_id):
    """LMS Cognitive Twin skill profile. A student sees only their own; staff
    (trainers/admins) may view any learner's."""
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only view your own skill map.")
    with _db().session() as s:
        return ok(_svc().skill_profile(s, learner_id))


@bp.get("/lms/v1/assessments/coach/<learner_id>")
@require_roles(*READ)
def coach(learner_id):
    """The learner's persistent AI study plan. Reuses the stored plan unless the
    profile changed or ?force=1 is passed (regenerate)."""
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only view your own coach.")
    force = request.args.get("force") in ("1", "true", "yes")
    with _db().session() as s:
        return ok(_svc().coach(s, learner_id, force=force))


@bp.post("/lms/v1/assessments/coach/<learner_id>/progress")
@require_roles(*READ)
def coach_progress(learner_id):
    """Mark a plan day done/undone — persisted progress against the plan."""
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only update your own plan.")
    b = request.get_json(silent=True) or {}
    day = b.get("day")
    if not day:
        raise BadRequest("day is required", code="day_required")
    with _db().session() as s:
        return ok(_svc().set_day_progress(s, learner_id, day, bool(b.get("done", True))))


@bp.post("/lms/v1/assessments/coach/nudge-due")
@require_roles("super_admin", "company_admin")
def coach_nudge_due():
    """Scheduled auto-nudger: nudge every learner whose plan is due (not touched
    in N days and not finished). Called by a daily cron / systemd timer. Returns
    how many were nudged. Idempotent within the window via last_nudged_at."""
    days = int((request.get_json(silent=True) or {}).get("days", 3))
    bus = current_app.extensions.get("bus")
    sent = 0
    with _db().session() as s:
        due = _svc().due_nudges(s, days=days)
    for learner_id in due:
        with _db().session() as s:
            payload = _svc().nudge_payload(s, learner_id)
        if not payload.get("has_plan"):
            continue
        if bus:
            bus.publish("coach.nudge", payload)
        with _db().session() as s:
            _svc().mark_nudged(s, learner_id)
        sent += 1
    return ok({"due": len(due), "nudged": sent})


@bp.post("/lms/v1/assessments/nudge/<learner_id>")
@require_roles(*READ)
def nudge(learner_id):
    """Send the learner their weakest area + plan via in-app + email (the coach
    nudge). A student may nudge themselves; staff may nudge any learner."""
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only nudge yourself.")
    with _db().session() as s:
        payload = _svc().nudge_payload(s, learner_id)
    if not payload.get("has_plan"):
        return ok({"sent": False, "message": "Take an assessment first to get a plan."})
    bus = current_app.extensions.get("bus")
    if bus:
        bus.publish("coach.nudge", payload)
    with _db().session() as s:
        _svc().mark_nudged(s, learner_id)
    return ok({"sent": True, "emailed": bool(payload.get("email"))})


# ---------------------------------------------------------------------------
# Career readiness — the LMS Skills-to-Opportunity map (Learn-domain only).
# ---------------------------------------------------------------------------
@bp.get("/lms/v1/careers")
@require_roles(*READ)
def list_careers():
    with _db().session() as s:
        return ok([_svc().career_out(c) for c in _svc().list_careers(s)])


@bp.post("/lms/v1/careers")
@require_roles(*AUTHOR)
def create_career():
    data = _parse(CareerIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().career_out(_svc().create_career(s, data)))


@bp.delete("/lms/v1/careers/<cid>")
@require_roles(*AUTHOR)
def delete_career(cid):
    with _db().session() as s:
        return ok(_svc().delete_career(s, cid))


@bp.get("/lms/v1/careers/readiness/<learner_id>")
@require_roles(*READ)
def career_readiness(learner_id):
    """Ranked career-role readiness for the learner. Students see their own;
    staff may view any."""
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only view your own readiness.")
    with _db().session() as s:
        return ok(_svc().career_readiness(s, learner_id))


# ---------------------------------------------------------------------------
# Embodied Practice Worlds — browser workplace simulations.
# ---------------------------------------------------------------------------
@bp.get("/lms/v1/worlds")
@require_roles(*READ)
def list_worlds():
    with _db().session() as s:
        return ok(_svc().list_worlds(s))


@bp.post("/lms/v1/worlds")
@require_roles(*AUTHOR)
def create_world():
    data = _parse(WorldIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().world_card(_svc().create_world(s, data)))


@bp.post("/lms/v1/worlds/<world_id>/start")
@require_roles(*READ)
def start_world(world_id):
    ident = current_identity()
    with _db().session() as s:
        return created(_svc().start_world(s, ident.user_id, world_id))


@bp.post("/lms/v1/worlds/runs/<run_id>/answer")
@require_roles(*READ)
def answer_world(run_id):
    ident = current_identity()
    data = _parse(WorldAnswerIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().answer_world(s, ident.user_id, run_id,
                                      data.step_id, data.choice))


# ---------------------------------------------------------------------------
# Generative Learning Fabric — on-demand AI micro-lessons.
# ---------------------------------------------------------------------------
@bp.post("/lms/v1/micro-lessons/<learner_id>/generate")
@require_roles(*READ)
def generate_lesson(learner_id):
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only generate your own lessons.")
    data = _parse(LessonIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().generate_lesson(s, learner_id, data.topic, data.force))


@bp.post("/lms/v1/micro-lessons/author-blocks")
@require_roles(*AUTHOR)
def author_blocks():
    """Generate lesson blocks for a trainer/admin to review + save into a
    curriculum lesson (the Curriculum Studio 'AI generate material' button)."""
    data = _parse(LessonIn, request.get_json(silent=True))
    with _db().session():
        return ok(_svc().author_blocks(data.topic))


@bp.get("/lms/v1/micro-lessons/<learner_id>")
@require_roles(*READ)
def list_lessons(learner_id):
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only view your own lessons.")
    with _db().session() as s:
        return ok(_svc().list_lessons(s, learner_id))


# ---------------------------------------------------------------------------
# Human Knowledge Mesh — AI-matched peer teach-back.
# ---------------------------------------------------------------------------
@bp.get("/lms/v1/mesh/<learner_id>")
@require_roles(*READ)
def mesh_overview(learner_id):
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only view your own mesh.")
    with _db().session() as s:
        return ok(_svc().mesh_overview(s, learner_id))


@bp.get("/lms/v1/mesh/<learner_id>/sessions")
@require_roles(*READ)
def mesh_sessions(learner_id):
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only view your own sessions.")
    with _db().session() as s:
        return ok(_svc().my_teach_sessions(s, learner_id))


@bp.post("/lms/v1/mesh/request")
@require_roles(*READ)
def mesh_request():
    ident = current_identity()
    data = _parse(TeachRequestIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().request_teach(s, ident.user_id, data.topic,
                                            data.mentor_id, data.note))


@bp.post("/lms/v1/mesh/<session_id>/respond")
@require_roles(*READ)
def mesh_respond(session_id):
    ident = current_identity()
    data = _parse(TeachRespondIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().respond_teach(s, session_id, ident.user_id, data.accept))


@bp.post("/lms/v1/mesh/<session_id>/complete")
@require_roles(*READ)
def mesh_complete(session_id):
    ident = current_identity()
    with _db().session() as s:
        return ok(_svc().complete_teach(s, session_id, ident.user_id))


# ---------------------------------------------------------------------------
# Flow layer — adaptive MCQ drill that keeps the learner in their flow zone.
# ---------------------------------------------------------------------------
@bp.post("/lms/v1/drill/start")
@require_roles(*READ)
def drill_start():
    ident = current_identity()
    data = _parse(DrillStartIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().start_drill(s, ident.user_id, data.topic, data.target))


@bp.post("/lms/v1/drill/<drill_id>/answer")
@require_roles(*READ)
def drill_answer(drill_id):
    ident = current_identity()
    data = _parse(DrillAnswerIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().answer_drill(s, ident.user_id, drill_id,
                                      data.item_id, data.option, data.elapsed_ms))


# ---------------------------------------------------------------------------
# Sovereign Learning Wallet — a signed, learner-owned, verifiable credential.
# ---------------------------------------------------------------------------
@bp.get("/lms/v1/wallet/<learner_id>")
@require_roles(*READ)
def get_wallet(learner_id):
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only view your own wallet.")
    with _db().session() as s:
        cred = _svc().get_wallet(s, learner_id)
    return ok(cred or {"credential": None})


@bp.post("/lms/v1/wallet/<learner_id>/issue")
@require_roles(*READ)
def issue_wallet(learner_id):
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only issue your own wallet.")
    with _db().session() as s:
        return created(_svc().issue_wallet(s, learner_id))


@bp.post("/lms/v1/wallet/<learner_id>/revoke")
@require_roles(*READ)
def revoke_wallet(learner_id):
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only revoke your own wallet.")
    with _db().session() as s:
        return ok(_svc().revoke_wallet(s, learner_id))


@bp.get("/lms/v1/wallet/<learner_id>/export.pdf")
@require_roles(*READ)
def export_wallet_pdf(learner_id):
    from flask import Response
    from lare_common.exports import to_pdf
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only export your own wallet.")
    with _db().session() as s:
        cred = _svc().get_wallet(s, learner_id)
        if not cred:
            raise BadRequest("Issue your wallet first", code="no_wallet")
        lines = _svc().wallet_pdf_lines(cred)
    pdf = to_pdf("LARE Verified Competence Wallet", lines)
    return Response(pdf, mimetype="application/pdf", headers={
        "Content-Disposition": "attachment; filename=lare-wallet.pdf"})


@bp.get("/verify/wallet/<verify_id>")
def verify_wallet(verify_id):
    """PUBLIC (no auth) — anyone can confirm a shared wallet credential."""
    with _db().session() as s:
        return ok(_svc().verify_wallet(s, verify_id))


# ---------------------------------------------------------------------------
# Lifelong Reinforcement — forgetting-aware spaced review (Keep Sharp).
# ---------------------------------------------------------------------------
@bp.get("/lms/v1/reviews/<learner_id>")
@require_roles(*READ)
def review_queue(learner_id):
    """Skills due for a maintenance review (worst retention first)."""
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only view your own reviews.")
    with _db().session() as s:
        return ok(_svc().review_queue(s, learner_id))


@bp.post("/lms/v1/reviews/<learner_id>/activity")
@require_roles(*READ)
def review_activity(learner_id):
    """Record real practice of a skill (e.g. answering an in-lesson check) so it
    enters/refreshes the learner's forgetting-curve review schedule."""
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only record your own activity.")
    b = request.get_json(silent=True) or {}
    skill = (b.get("skill") or "").strip()
    if not skill:
        raise BadRequest("skill is required", code="skill_required")
    with _db().session() as s:
        _svc().record_activity(s, learner_id, skill, float(b.get("mastery", 0) or 0),
                               good=bool(b.get("good", False)),
                               source=b.get("source", "written"))
    return ok({"recorded": True, "skill": skill})


@bp.post("/lms/v1/reviews/<learner_id>/review")
@require_roles(*READ)
def do_review(learner_id):
    """Self-check outcome for a skill: 'good' (recalled) or 'rusty'. Reschedules."""
    ident = current_identity()
    if not ident.has_role(*STAFF_LMS) and learner_id != ident.user_id:
        raise Forbidden("You can only review your own skills.")
    b = request.get_json(silent=True) or {}
    skill = b.get("skill")
    outcome = "good" if b.get("outcome") == "good" else "rusty"
    if not skill:
        raise BadRequest("skill is required", code="skill_required")
    with _db().session() as s:
        return ok(_svc().mark_reviewed(s, learner_id, skill, outcome))


@bp.get("/lms/v1/assessments/<aid>")
@require_roles(*READ)
def get_assessment(aid):
    ident = current_identity()
    with _db().session() as s:
        a = _svc().get(s, aid)
        return ok({**_svc().out(a),
                   "items": _svc().delivery_items(s, a, ident.user_id)})


@bp.post("/lms/v1/assessments/<aid>/attempts")
def start(aid):
    ident = current_identity()
    data = _parse(StartIn, request.get_json(silent=True))
    # Students start their own attempt; staff may start on behalf (e.g. proctored).
    learner_id = data.learner_id or ident.user_id
    with _db().session() as s:
        return created(_svc().start(s, aid, learner_id))


@bp.post("/lms/v1/attempts/<attempt_id>/submit")
def submit(attempt_id):
    ident = current_identity()
    data = _parse(SubmitIn, request.get_json(silent=True))
    with _db().session() as s:
        result = _svc().submit(s, attempt_id, ident.user_id, data.answers)
    # Feed the scorecard (Progress) and XP (Gamification) via the event bus.
    bus = current_app.extensions.get("bus")
    if bus and result.get("percentage") is not None and not result.get("pending_grading"):
        bus.publish("assessment.scored", {
            "learner_id": result.get("learner_id") or ident.user_id,
            "assessment_id": result.get("assessment_id"),
            "score": result.get("percentage"), "passed": result.get("passed"),
            "category": data.category if hasattr(data, "category") else None,
        })
    return ok(result)


@bp.post("/lms/v1/answers/<answer_id>/grade")
@require_roles(*AUTHOR)
def grade(answer_id):
    ident = current_identity()
    data = _parse(GradeIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().grade_answer(s, answer_id, data.score, ident.user_id))
