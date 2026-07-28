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

