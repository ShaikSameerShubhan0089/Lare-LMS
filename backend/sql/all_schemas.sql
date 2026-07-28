-- LARE platform — full schema DDL for Supabase PostgreSQL
-- Schema-per-service. Idempotent (CREATE ... IF NOT EXISTS).
-- Apply in the Supabase SQL Editor, or: bash migrate-supabase.sh


-- ============================================================
-- Service schema: lare_auth
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "lare_auth";

CREATE TABLE IF NOT EXISTS lare_auth.permissions (
	id VARCHAR NOT NULL, 
	code VARCHAR(128) NOT NULL, 
	description VARCHAR(255), 
	domain VARCHAR(64), 
	PRIMARY KEY (id), 
	UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS lare_auth.roles (
	id VARCHAR NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	description VARCHAR(255), 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS lare_auth.users (
	id VARCHAR NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	full_name VARCHAR(255), 
	status VARCHAR(32) NOT NULL, 
	email_verified BOOLEAN NOT NULL, 
	mfa_enabled BOOLEAN NOT NULL, 
	tenant_id VARCHAR(64) NOT NULL, 
	failed_attempts INTEGER NOT NULL, 
	locked_until TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS lare_auth.refresh_tokens (
	id VARCHAR NOT NULL, 
	user_id VARCHAR NOT NULL, 
	family_id VARCHAR NOT NULL, 
	token_hash VARCHAR(128) NOT NULL, 
	device VARCHAR(255), 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	revoked_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES lare_auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lare_auth.role_permissions (
	role_id VARCHAR NOT NULL, 
	permission_id VARCHAR NOT NULL, 
	PRIMARY KEY (role_id, permission_id), 
	FOREIGN KEY(role_id) REFERENCES lare_auth.roles (id) ON DELETE CASCADE, 
	FOREIGN KEY(permission_id) REFERENCES lare_auth.permissions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lare_auth.user_roles (
	id VARCHAR NOT NULL, 
	user_id VARCHAR NOT NULL, 
	role_id VARCHAR NOT NULL, 
	college_id VARCHAR(64), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_role_college UNIQUE (user_id, role_id, college_id), 
	FOREIGN KEY(user_id) REFERENCES lare_auth.users (id) ON DELETE CASCADE, 
	FOREIGN KEY(role_id) REFERENCES lare_auth.roles (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lare_auth.verification_tokens (
	id VARCHAR NOT NULL, 
	user_id VARCHAR NOT NULL, 
	purpose VARCHAR(24) NOT NULL, 
	token_hash VARCHAR(128) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	consumed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES lare_auth.users (id) ON DELETE CASCADE
);


-- ============================================================
-- Service schema: institution
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "institution";

CREATE TABLE IF NOT EXISTS institution.colleges (
	id VARCHAR NOT NULL, 
	tenant_id VARCHAR(64) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	address VARCHAR(512), 
	timezone VARCHAR(64) NOT NULL, 
	mou_ref VARCHAR(128), 
	status VARCHAR(32) NOT NULL, 
	coordinator_user_id VARCHAR(64), 
	passing_threshold INTEGER NOT NULL, 
	min_cohort_size INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS institution.academic_years (
	id VARCHAR NOT NULL, 
	college_id VARCHAR NOT NULL, 
	year_no INTEGER NOT NULL, 
	start DATE, 
	"end" DATE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(college_id) REFERENCES institution.colleges (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS institution.assignments (
	id VARCHAR NOT NULL, 
	college_id VARCHAR NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	role VARCHAR(32) NOT NULL, 
	scope VARCHAR(64), 
	PRIMARY KEY (id), 
	FOREIGN KEY(college_id) REFERENCES institution.colleges (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS institution.branches (
	id VARCHAR NOT NULL, 
	college_id VARCHAR NOT NULL, 
	name VARCHAR(128) NOT NULL, 
	code VARCHAR(32) NOT NULL, 
	category VARCHAR(16) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_branch_code UNIQUE (college_id, code), 
	FOREIGN KEY(college_id) REFERENCES institution.colleges (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS institution.cohorts (
	id VARCHAR NOT NULL, 
	college_id VARCHAR NOT NULL, 
	branch_id VARCHAR NOT NULL, 
	academic_year_id VARCHAR, 
	section VARCHAR(16), 
	year_no INTEGER NOT NULL, 
	size INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(college_id) REFERENCES institution.colleges (id) ON DELETE CASCADE, 
	FOREIGN KEY(branch_id) REFERENCES institution.branches (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS institution.semesters (
	id VARCHAR NOT NULL, 
	academic_year_id VARCHAR NOT NULL, 
	type VARCHAR(8) NOT NULL, 
	start DATE, 
	"end" DATE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(academic_year_id) REFERENCES institution.academic_years (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS institution.schedule_slots (
	id VARCHAR NOT NULL, 
	semester_id VARCHAR NOT NULL, 
	branch_id VARCHAR NOT NULL, 
	week_no INTEGER NOT NULL, 
	module_ref VARCHAR(128), 
	start DATE, 
	"end" DATE, 
	trainer_user_id VARCHAR(64), 
	PRIMARY KEY (id), 
	FOREIGN KEY(semester_id) REFERENCES institution.semesters (id) ON DELETE CASCADE, 
	FOREIGN KEY(branch_id) REFERENCES institution.branches (id) ON DELETE CASCADE
);


-- ============================================================
-- Service schema: learner
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "learner";

CREATE TABLE IF NOT EXISTS learner.imports (
	id VARCHAR NOT NULL, 
	college_id VARCHAR(64) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	summary JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS learner.learners (
	id VARCHAR NOT NULL, 
	user_id VARCHAR(64), 
	college_id VARCHAR(64) NOT NULL, 
	cohort_id VARCHAR(64), 
	branch_id VARCHAR(64), 
	roll_no VARCHAR(64) NOT NULL, 
	full_name VARCHAR(255), 
	email VARCHAR(255), 
	cgpa FLOAT, 
	photo_file_id VARCHAR(64), 
	status VARCHAR(16) NOT NULL, 
	verified BOOLEAN NOT NULL, 
	year_no INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_learner_roll UNIQUE (college_id, roll_no)
);

CREATE TABLE IF NOT EXISTS learner.enrollments (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR NOT NULL, 
	academic_year_id VARCHAR(64), 
	year_no INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(learner_id) REFERENCES learner.learners (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learner.projects (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description VARCHAR(1024), 
	repo_url VARCHAR(512), 
	PRIMARY KEY (id), 
	FOREIGN KEY(learner_id) REFERENCES learner.learners (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learner.skills (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR NOT NULL, 
	skill VARCHAR(64) NOT NULL, 
	level VARCHAR(32), 
	source VARCHAR(64), 
	PRIMARY KEY (id), 
	FOREIGN KEY(learner_id) REFERENCES learner.learners (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learner.stream_selection (
	learner_id VARCHAR NOT NULL, 
	stream VARCHAR(32) NOT NULL, 
	rationale VARCHAR(512), 
	mentor_user_id VARCHAR(64), 
	decided_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (learner_id), 
	FOREIGN KEY(learner_id) REFERENCES learner.learners (id) ON DELETE CASCADE
);


-- ============================================================
-- Service schema: curriculum
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "curriculum";

CREATE TABLE IF NOT EXISTS curriculum.curricula (
	id VARCHAR NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	version INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS curriculum.cohort_curriculum (
	id VARCHAR NOT NULL, 
	cohort_id VARCHAR(64) NOT NULL, 
	curriculum_id VARCHAR NOT NULL, 
	effective_from DATE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(curriculum_id) REFERENCES curriculum.curricula (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.year_tracks (
	id VARCHAR NOT NULL, 
	curriculum_id VARCHAR NOT NULL, 
	year_no INTEGER NOT NULL, 
	theme VARCHAR(255), 
	goal VARCHAR(512), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_year UNIQUE (curriculum_id, year_no), 
	FOREIGN KEY(curriculum_id) REFERENCES curriculum.curricula (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.modules (
	id VARCHAR NOT NULL, 
	year_track_id VARCHAR NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	"order" INTEGER NOT NULL, 
	branch_scope VARCHAR(32) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(year_track_id) REFERENCES curriculum.year_tracks (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.outcome_checks (
	id VARCHAR NOT NULL, 
	year_track_id VARCHAR NOT NULL, 
	statement VARCHAR(512) NOT NULL, 
	criteria VARCHAR(512), 
	PRIMARY KEY (id), 
	FOREIGN KEY(year_track_id) REFERENCES curriculum.year_tracks (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.lessons (
	id VARCHAR NOT NULL, 
	module_id VARCHAR NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	"order" INTEGER NOT NULL, 
	content_ref VARCHAR(128), 
	PRIMARY KEY (id), 
	FOREIGN KEY(module_id) REFERENCES curriculum.modules (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.objectives (
	id VARCHAR NOT NULL, 
	lesson_id VARCHAR NOT NULL, 
	statement VARCHAR(512) NOT NULL, 
	skill_tag VARCHAR(64), 
	PRIMARY KEY (id), 
	FOREIGN KEY(lesson_id) REFERENCES curriculum.lessons (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.item_objective_map (
	id VARCHAR NOT NULL, 
	objective_id VARCHAR NOT NULL, 
	item_type VARCHAR(16) NOT NULL, 
	item_id VARCHAR(64) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(objective_id) REFERENCES curriculum.objectives (id) ON DELETE CASCADE
);


-- ============================================================
-- Service schema: content
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "content";

CREATE TABLE IF NOT EXISTS content.consumption (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	content_item_id VARCHAR(64) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	position_sec INTEGER NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_consumption UNIQUE (learner_id, content_item_id)
);

CREATE TABLE IF NOT EXISTS content.content_items (
	id VARCHAR NOT NULL, 
	lesson_id VARCHAR(64) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	type VARCHAR(16) NOT NULL, 
	file_id VARCHAR(64), 
	url VARCHAR(512), 
	duration_sec INTEGER NOT NULL, 
	difficulty VARCHAR(16) NOT NULL, 
	"order" INTEGER NOT NULL, 
	objectives JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS content.gates (
	id VARCHAR NOT NULL, 
	content_item_id VARCHAR NOT NULL, 
	rule_type VARCHAR(32) NOT NULL, 
	rule_config JSON NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(content_item_id) REFERENCES content.content_items (id) ON DELETE CASCADE
);


-- ============================================================
-- Service schema: progress
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "progress";

CREATE TABLE IF NOT EXISTS progress.attendance (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	schedule_slot_id VARCHAR(64) NOT NULL, 
	status VARCHAR(8) NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS progress.module_progress (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	module_id VARCHAR(64) NOT NULL, 
	completion_pct FLOAT NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_module_progress UNIQUE (learner_id, module_id)
);

CREATE TABLE IF NOT EXISTS progress.score_events (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	year_no INTEGER NOT NULL, 
	dimension VARCHAR(16) NOT NULL, 
	value FLOAT NOT NULL, 
	source VARCHAR(64), 
	ref_id VARCHAR(64), 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS progress.scorecard (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	year_no INTEGER NOT NULL, 
	communication FLOAT NOT NULL, 
	coding FLOAT NOT NULL, 
	aptitude FLOAT NOT NULL, 
	project FLOAT NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_scorecard UNIQUE (learner_id, year_no)
);

CREATE TABLE IF NOT EXISTS progress.year_status (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	year_no INTEGER NOT NULL, 
	criteria_met BOOLEAN NOT NULL, 
	attendance_pct FLOAT NOT NULL, 
	avg_score FLOAT NOT NULL, 
	computed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_year_status UNIQUE (learner_id, year_no)
);


-- ============================================================
-- Service schema: assessment
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "assessment";

CREATE TABLE IF NOT EXISTS assessment.assessments (
	id VARCHAR NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	year_no INTEGER NOT NULL, 
	type VARCHAR(32) NOT NULL, 
	time_limit_min INTEGER NOT NULL, 
	attempts_allowed INTEGER NOT NULL, 
	passing_pct INTEGER NOT NULL, 
	negative_marking FLOAT NOT NULL, 
	dimension VARCHAR(16) NOT NULL, 
	objectives JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS assessment.attempts (
	id VARCHAR NOT NULL, 
	assessment_id VARCHAR(64) NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	score FLOAT NOT NULL, 
	max_score FLOAT NOT NULL, 
	percentage FLOAT NOT NULL, 
	passed BOOLEAN NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	submitted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS assessment.answers (
	id VARCHAR NOT NULL, 
	attempt_id VARCHAR NOT NULL, 
	item_id VARCHAR(64) NOT NULL, 
	response JSON NOT NULL, 
	auto_score FLOAT, 
	final_score FLOAT, 
	needs_grade BOOLEAN NOT NULL, 
	grader_user_id VARCHAR(64), 
	max_score FLOAT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(attempt_id) REFERENCES assessment.attempts (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assessment.assessment_items (
	id VARCHAR NOT NULL, 
	assessment_id VARCHAR NOT NULL, 
	item_type VARCHAR(16) NOT NULL, 
	prompt VARCHAR(1024) NOT NULL, 
	options JSON NOT NULL, 
	correct JSON NOT NULL, 
	weight FLOAT NOT NULL, 
	rubric_hint VARCHAR(1024), 
	"order" INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(assessment_id) REFERENCES assessment.assessments (id) ON DELETE CASCADE
);


-- ============================================================
-- Service schema: gamification
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "gamification";

CREATE TABLE IF NOT EXISTS gamification.badges (
	id VARCHAR NOT NULL, 
	code VARCHAR(64) NOT NULL, 
	name VARCHAR(128) NOT NULL, 
	description VARCHAR(255), 
	icon VARCHAR(64), 
	PRIMARY KEY (id), 
	UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS gamification.learner_badges (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	badge_code VARCHAR(64) NOT NULL, 
	earned_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_learner_badge UNIQUE (learner_id, badge_code)
);

CREATE TABLE IF NOT EXISTS gamification.levels (
	learner_id VARCHAR(64) NOT NULL, 
	total_xp INTEGER NOT NULL, 
	level INTEGER NOT NULL, 
	display_name VARCHAR(120), 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (learner_id)
);

CREATE TABLE IF NOT EXISTS gamification.streaks (
	learner_id VARCHAR(64) NOT NULL, 
	current INTEGER NOT NULL, 
	longest INTEGER NOT NULL, 
	last_active_day DATE, 
	freezes INTEGER NOT NULL, 
	PRIMARY KEY (learner_id)
);

CREATE TABLE IF NOT EXISTS gamification.xp_ledger (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	action VARCHAR(64) NOT NULL, 
	points INTEGER NOT NULL, 
	source_event_id VARCHAR(96), 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_xp_event UNIQUE (learner_id, source_event_id)
);


-- ============================================================
-- Service schema: certification
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "certification";

CREATE TABLE IF NOT EXISTS certification.certificates (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	year_no INTEGER NOT NULL, 
	template_id VARCHAR(64), 
	cert_no VARCHAR(64) NOT NULL, 
	cert_name VARCHAR(255) NOT NULL, 
	verify_id VARCHAR(64) NOT NULL, 
	file_id VARCHAR(64), 
	status VARCHAR(16) NOT NULL, 
	ppo_tag BOOLEAN NOT NULL, 
	holder_name VARCHAR(255), 
	issued_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_cert UNIQUE (learner_id, year_no), 
	UNIQUE (cert_no)
);

CREATE TABLE IF NOT EXISTS certification.templates (
	id VARCHAR NOT NULL, 
	year_no INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	signatories VARCHAR(512), 
	version INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_template_year UNIQUE (year_no)
);

CREATE TABLE IF NOT EXISTS certification.revocations (
	id VARCHAR NOT NULL, 
	certificate_id VARCHAR NOT NULL, 
	reason VARCHAR(512), 
	revoked_by VARCHAR(64), 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(certificate_id) REFERENCES certification.certificates (id) ON DELETE CASCADE
);


-- ============================================================
-- Service schema: candidate
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "candidate";

CREATE TABLE IF NOT EXISTS candidate.candidates (
	id VARCHAR NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	learner_id VARCHAR(64), 
	college_id VARCHAR(64), 
	full_name VARCHAR(255), 
	email VARCHAR(255), 
	phone VARCHAR(32), 
	branch VARCHAR(64), 
	cgpa FLOAT, 
	photo_file_id VARCHAR(64), 
	resume_file_id VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS candidate.applications (
	id VARCHAR NOT NULL, 
	candidate_id VARCHAR NOT NULL, 
	drive_id VARCHAR(64) NOT NULL, 
	drive_role_id VARCHAR(64), 
	status VARCHAR(24) NOT NULL, 
	eligibility_snapshot JSON NOT NULL, 
	applied_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_application UNIQUE (candidate_id, drive_id), 
	FOREIGN KEY(candidate_id) REFERENCES candidate.candidates (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS candidate.education (
	id VARCHAR NOT NULL, 
	candidate_id VARCHAR NOT NULL, 
	degree VARCHAR(128) NOT NULL, 
	institution VARCHAR(255), 
	year INTEGER, 
	score VARCHAR(32), 
	PRIMARY KEY (id), 
	FOREIGN KEY(candidate_id) REFERENCES candidate.candidates (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS candidate.projects (
	id VARCHAR NOT NULL, 
	candidate_id VARCHAR NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description VARCHAR(1024), 
	repo_url VARCHAR(512), 
	PRIMARY KEY (id), 
	FOREIGN KEY(candidate_id) REFERENCES candidate.candidates (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS candidate.skills (
	id VARCHAR NOT NULL, 
	candidate_id VARCHAR NOT NULL, 
	skill VARCHAR(64) NOT NULL, 
	level VARCHAR(32), 
	PRIMARY KEY (id), 
	FOREIGN KEY(candidate_id) REFERENCES candidate.candidates (id) ON DELETE CASCADE
);


-- ============================================================
-- Service schema: drive
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "drive";

CREATE TABLE IF NOT EXISTS drive.drives (
	id VARCHAR NOT NULL, 
	company_id VARCHAR(64) NOT NULL, 
	company_name VARCHAR(255) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	status VARCHAR(24) NOT NULL, 
	reporting_time VARCHAR(64), 
	venue VARCHAR(255), 
	schedule JSON NOT NULL, 
	created_by VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS drive.application_forms (
	drive_id VARCHAR NOT NULL, 
	fields JSON NOT NULL, 
	PRIMARY KEY (drive_id), 
	FOREIGN KEY(drive_id) REFERENCES drive.drives (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drive.drive_roles (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	ctc VARCHAR(64), 
	positions INTEGER NOT NULL, 
	description VARCHAR(1024), 
	PRIMARY KEY (id), 
	FOREIGN KEY(drive_id) REFERENCES drive.drives (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drive.eligibility_rules (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR NOT NULL, 
	rule JSON NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(drive_id) REFERENCES drive.drives (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drive.form_submissions (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	answers JSON NOT NULL, 
	submitted_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_form_sub UNIQUE (drive_id, candidate_id), 
	FOREIGN KEY(drive_id) REFERENCES drive.drives (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drive.ppo_config (
	drive_id VARCHAR NOT NULL, 
	eligibility JSON NOT NULL, 
	stages JSON NOT NULL, 
	conversion_criteria JSON NOT NULL, 
	PRIMARY KEY (drive_id), 
	FOREIGN KEY(drive_id) REFERENCES drive.drives (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drive.registrations (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	status VARCHAR(24) NOT NULL, 
	current_round INTEGER NOT NULL, 
	eligible VARCHAR(8) NOT NULL, 
	joining_status VARCHAR(24), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_registration UNIQUE (drive_id, candidate_id), 
	FOREIGN KEY(drive_id) REFERENCES drive.drives (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drive.rounds (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR NOT NULL, 
	"order" INTEGER NOT NULL, 
	type VARCHAR(24) NOT NULL, 
	label VARCHAR(120), 
	optional BOOLEAN NOT NULL, 
	config JSON NOT NULL, 
	service_ref VARCHAR(64), 
	PRIMARY KEY (id), 
	FOREIGN KEY(drive_id) REFERENCES drive.drives (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drive.seat_allocations (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	lab VARCHAR(64) NOT NULL, 
	system_no INTEGER NOT NULL, 
	seat_no VARCHAR(16) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_seat UNIQUE (drive_id, candidate_id), 
	FOREIGN KEY(drive_id) REFERENCES drive.drives (id) ON DELETE CASCADE
);


-- ============================================================
-- Service schema: questionbank
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "questionbank";

CREATE TABLE IF NOT EXISTS questionbank.blueprints (
	id VARCHAR NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	spec JSON NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS questionbank.questions (
	id VARCHAR NOT NULL, 
	type VARCHAR(16) NOT NULL, 
	category VARCHAR(16) NOT NULL, 
	difficulty VARCHAR(8) NOT NULL, 
	tags JSON NOT NULL, 
	stem VARCHAR(2048) NOT NULL, 
	options JSON NOT NULL, 
	answer_key JSON NOT NULL, 
	explanation VARCHAR(1024), 
	weight FLOAT NOT NULL, 
	version INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	author_id VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);


-- ============================================================
-- Service schema: exam
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "exam";

CREATE TABLE IF NOT EXISTS exam.exam_answers (
	id VARCHAR NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	question_id VARCHAR(64) NOT NULL, 
	response JSON NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_answer UNIQUE (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS exam.exam_sessions (
	id VARCHAR NOT NULL, 
	exam_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	submitted_at TIMESTAMP WITH TIME ZONE, 
	section_state JSON NOT NULL, 
	auto_submitted BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_session UNIQUE (exam_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS exam.exams (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR(64), 
	round_id VARCHAR(64), 
	title VARCHAR(255) NOT NULL, 
	total_time_min INTEGER NOT NULL, 
	negative_marking FLOAT NOT NULL, 
	nav_rule VARCHAR(8) NOT NULL, 
	sections JSON NOT NULL, 
	window_start TIMESTAMP WITH TIME ZONE, 
	window_end TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
);


-- ============================================================
-- Service schema: submission
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "submission";

CREATE TABLE IF NOT EXISTS submission.answer_latest (
	id VARCHAR NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	question_id VARCHAR(64) NOT NULL, 
	response JSON NOT NULL, 
	client_seq INTEGER NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_latest UNIQUE (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS submission.answers (
	id VARCHAR NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	question_id VARCHAR(64) NOT NULL, 
	response JSON NOT NULL, 
	source VARCHAR(16) NOT NULL, 
	client_seq INTEGER NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS submission.final_submissions (
	id VARCHAR NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	snapshot JSON NOT NULL, 
	answer_count INTEGER NOT NULL, 
	submitted_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	finalized BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_final UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS submission.time_spent (
	id VARCHAR NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	question_id VARCHAR(64) NOT NULL, 
	seconds INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_time UNIQUE (session_id, question_id)
);


-- ============================================================
-- Service schema: anticheat
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "anticheat";

CREATE TABLE IF NOT EXISTS anticheat.events (
	id VARCHAR NOT NULL, 
	proctor_session_id VARCHAR(64) NOT NULL, 
	type VARCHAR(32) NOT NULL, 
	weight INTEGER NOT NULL, 
	ip VARCHAR(64), 
	browser VARCHAR(128), 
	device VARCHAR(128), 
	meta JSON NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS anticheat.proctor_sessions (
	id VARCHAR NOT NULL, 
	exam_session_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	drive_id VARCHAR(64), 
	fingerprint VARCHAR(128), 
	ip VARCHAR(64), 
	browser VARCHAR(128), 
	violation_score INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);


-- ============================================================
-- Service schema: coding
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "coding";

CREATE TABLE IF NOT EXISTS coding.coding_sessions (
	id VARCHAR NOT NULL, 
	problem_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	exam_session_id VARCHAR(64), 
	language VARCHAR(16) NOT NULL, 
	draft_code VARCHAR NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS coding.coding_submissions (
	id VARCHAR NOT NULL, 
	coding_session_id VARCHAR(64) NOT NULL, 
	code VARCHAR NOT NULL, 
	score FLOAT NOT NULL, 
	cases_passed INTEGER NOT NULL, 
	total_cases INTEGER NOT NULL, 
	detail JSON NOT NULL, 
	submitted_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS coding.problems (
	id VARCHAR NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	statement VARCHAR(4096) NOT NULL, 
	languages JSON NOT NULL, 
	time_limit_sec INTEGER NOT NULL, 
	memory_limit_mb INTEGER NOT NULL, 
	sample_cases JSON NOT NULL, 
	hidden_cases JSON NOT NULL, 
	max_score FLOAT NOT NULL, 
	PRIMARY KEY (id)
);


-- ============================================================
-- Service schema: evaluation
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "evaluation";

CREATE TABLE IF NOT EXISTS evaluation.answer_keys (
	exam_id VARCHAR(64) NOT NULL, 
	items JSON NOT NULL, 
	passing_pct INTEGER NOT NULL, 
	negative_marking FLOAT NOT NULL, 
	PRIMARY KEY (exam_id)
);

CREATE TABLE IF NOT EXISTS evaluation.evaluations (
	id VARCHAR NOT NULL, 
	exam_id VARCHAR(64) NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	total FLOAT NOT NULL, 
	max_score FLOAT NOT NULL, 
	percentage FLOAT NOT NULL, 
	accuracy FLOAT NOT NULL, 
	passed BOOLEAN NOT NULL, 
	version INTEGER NOT NULL, 
	question_scores JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_eval_session UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS evaluation.ranks (
	id VARCHAR NOT NULL, 
	exam_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	rank INTEGER NOT NULL, 
	percentage FLOAT NOT NULL, 
	tie_break VARCHAR(128), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_rank UNIQUE (exam_id, candidate_id)
);


-- ============================================================
-- Service schema: interview
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "interview";

CREATE TABLE IF NOT EXISTS interview.interviews (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR(64) NOT NULL, 
	round_id VARCHAR(64), 
	candidate_id VARCHAR(64) NOT NULL, 
	stage VARCHAR(24) NOT NULL, 
	mode VARCHAR(16) NOT NULL, 
	link VARCHAR(512), 
	slot VARCHAR(64), 
	interviewer_id VARCHAR(64), 
	status VARCHAR(16) NOT NULL, 
	decision VARCHAR(16), 
	decision_reason VARCHAR(512), 
	avg_rating FLOAT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS interview.ratings (
	id VARCHAR NOT NULL, 
	interview_id VARCHAR NOT NULL, 
	interviewer_id VARCHAR(64) NOT NULL, 
	competency VARCHAR(32) NOT NULL, 
	score FLOAT NOT NULL, 
	remark VARCHAR(512), 
	PRIMARY KEY (id), 
	FOREIGN KEY(interview_id) REFERENCES interview.interviews (id) ON DELETE CASCADE
);


-- ============================================================
-- Service schema: result
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "result";

CREATE TABLE IF NOT EXISTS result.offers (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	role_id VARCHAR(64), 
	type VARCHAR(8) NOT NULL, 
	company_name VARCHAR(255), 
	role_title VARCHAR(255), 
	ctc VARCHAR(64), 
	letter_file_id VARCHAR(64), 
	verify_id VARCHAR(64) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	issued_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS result.results (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	final_score FLOAT NOT NULL, 
	rank INTEGER, 
	outcome VARCHAR(16) NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	published_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_result UNIQUE (drive_id, candidate_id)
);


-- ============================================================
-- Service schema: notification
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "notification";

CREATE TABLE IF NOT EXISTS notification.notifications (
	id VARCHAR NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	template_key VARCHAR(64) NOT NULL, 
	channel VARCHAR(16) NOT NULL, 
	payload JSON NOT NULL, 
	subject VARCHAR(255), 
	body VARCHAR(4096) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	dedupe_key VARCHAR(128), 
	read_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	sent_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS notification.preferences (
	id VARCHAR NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	channel VARCHAR(16) NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_preference UNIQUE (user_id, channel)
);

CREATE TABLE IF NOT EXISTS notification.templates (
	id VARCHAR NOT NULL, 
	key VARCHAR(64) NOT NULL, 
	channel VARCHAR(16) NOT NULL, 
	locale VARCHAR(8) NOT NULL, 
	subject VARCHAR(255), 
	body VARCHAR(4096) NOT NULL, 
	version INTEGER NOT NULL, 
	active BOOLEAN NOT NULL, 
	critical BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_template UNIQUE (key, channel, locale)
);


-- ============================================================
-- Service schema: files
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "files";

CREATE TABLE IF NOT EXISTS files.files (
	id VARCHAR NOT NULL, 
	owner_user_id VARCHAR(64) NOT NULL, 
	purpose VARCHAR(32) NOT NULL, 
	bucket VARCHAR(64) NOT NULL, 
	object_key VARCHAR(128) NOT NULL, 
	filename VARCHAR(255), 
	mime VARCHAR(128) NOT NULL, 
	size INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	scan_result VARCHAR(32), 
	entity_type VARCHAR(32), 
	entity_id VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);


-- ============================================================
-- Service schema: analytics
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "analytics";

CREATE TABLE IF NOT EXISTS analytics.dashboard_layouts (
	user_id VARCHAR(64) NOT NULL, 
	widgets JSON NOT NULL, 
	PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS analytics.facts (
	id VARCHAR NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	college_id VARCHAR(64), 
	cohort_id VARCHAR(64), 
	learner_id VARCHAR(64), 
	drive_id VARCHAR(64), 
	metric VARCHAR(32) NOT NULL, 
	value FLOAT NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);


-- ============================================================
-- Service schema: audit
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "audit";

CREATE TABLE IF NOT EXISTS audit.activity_logs (
	id VARCHAR NOT NULL, 
	user_id VARCHAR(64), 
	session_id VARCHAR(64), 
	event VARCHAR(64) NOT NULL, 
	context JSON NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS audit.audit_logs (
	id VARCHAR NOT NULL, 
	partition_key VARCHAR(64) NOT NULL, 
	seq INTEGER NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	actor_type VARCHAR(16) NOT NULL, 
	actor_id VARCHAR(64), 
	action VARCHAR(64) NOT NULL, 
	entity_type VARCHAR(32), 
	entity_id VARCHAR(64), 
	meta JSON NOT NULL, 
	ip VARCHAR(64), 
	device VARCHAR(128), 
	correlation_id VARCHAR(64), 
	prev_hash VARCHAR(64), 
	hash VARCHAR(64) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_audit_seq UNIQUE (partition_key, seq)
);


-- ============================================================
-- Service schema: ai_orchestration
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "ai_orchestration";

CREATE TABLE IF NOT EXISTS ai_orchestration.ai_calls (
	id VARCHAR(36) NOT NULL, 
	prompt_key VARCHAR(64) NOT NULL, 
	purpose VARCHAR(64) NOT NULL, 
	actor_id VARCHAR(64) NOT NULL, 
	model VARCHAR(64) NOT NULL, 
	mode VARCHAR(16) NOT NULL, 
	input_tokens INTEGER NOT NULL, 
	output_tokens INTEGER NOT NULL, 
	latency_ms INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	preview TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);


-- ============================================================
-- Service schema: ai_tutor
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "ai_tutor";

CREATE TABLE IF NOT EXISTS ai_tutor.tutor_sessions (
	id VARCHAR(36) NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS ai_tutor.tutor_messages (
	id VARCHAR(36) NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	role VARCHAR(16) NOT NULL, 
	content TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES ai_tutor.tutor_sessions (id)
);


-- ============================================================
-- Service schema: organization
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "organization";

CREATE TABLE IF NOT EXISTS organization.organizations (
	id VARCHAR(36) NOT NULL, 
	tenant_id VARCHAR(64) NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	slug VARCHAR(80) NOT NULL, 
	custom_domain VARCHAR(200), 
	timezone VARCHAR(48) NOT NULL, 
	branding JSON NOT NULL, 
	smtp_config JSON NOT NULL, 
	security_policy JSON NOT NULL, 
	feature_overrides JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	archived BOOLEAN NOT NULL, 
	pii_erased BOOLEAN NOT NULL, 
	PRIMARY KEY (id)
);

