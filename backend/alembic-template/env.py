"""Generic Alembic env shared by every LARE service.

Copy the `alembic-template/` files into a service (or point `-c` at a service's
alembic.ini) and run from that service's directory so `app.models` imports and
binds to lare_common's Base. Autogenerate then diffs the live DB against the
service's models. On Postgres each service migrates inside its own schema
(version_table_schema = DB_SCHEMA), matching the schema-per-domain layout.
"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from dotenv import load_dotenv

load_dotenv()

# Ensure the service root (containing the `app` package) is importable.
sys.path.insert(0, os.getcwd())

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# Import the service's models so they register on the shared Base metadata.
import app.models  # noqa: E402,F401
from lare_common.db import Base  # noqa: E402

target_metadata = Base.metadata

DB_URL = os.getenv("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
DB_SCHEMA = os.getenv("DB_SCHEMA") or None
IS_SQLITE = DB_URL.startswith("sqlite")


def _configure(**kw):
    context.configure(
        target_metadata=target_metadata,
        compare_type=True,
        include_schemas=not IS_SQLITE,
        version_table_schema=None if IS_SQLITE else DB_SCHEMA,
        **kw,
    )


def run_migrations_offline() -> None:
    _configure(url=DB_URL, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section) or {}
    section["sqlalchemy.url"] = DB_URL
    connectable = engine_from_config(section, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        if DB_SCHEMA and not IS_SQLITE:
            connection.exec_driver_sql(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"')
            connection.exec_driver_sql(f'SET search_path TO "{DB_SCHEMA}", public')
        _configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
