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

