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

