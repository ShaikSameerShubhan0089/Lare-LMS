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

