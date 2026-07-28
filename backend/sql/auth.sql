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

