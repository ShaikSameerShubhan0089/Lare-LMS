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

