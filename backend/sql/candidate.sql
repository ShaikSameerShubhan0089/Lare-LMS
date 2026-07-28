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

