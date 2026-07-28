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

