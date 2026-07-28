"""Emit PostgreSQL DDL for ONE service's schema + tables (stdout).

Run once per service in its own process (fresh interpreter) so each service's
models bind to a clean metadata — avoids cross-service table-name collisions.

Env:
  GEN_SCHEMA   target schema name (e.g. 'drive', 'lare_auth')
CWD must be the service directory (so `import app.models` resolves).
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.getcwd())

from sqlalchemy.dialects import postgresql  # noqa: E402
from sqlalchemy.schema import CreateTable  # noqa: E402

import app.models  # noqa: E402,F401  (registers this service's tables)
from lare_common.db import Base  # noqa: E402

schema = os.environ["GEN_SCHEMA"]
dialect = postgresql.dialect()

# Qualify every table with the target schema so DDL + FKs are schema-scoped.
for t in Base.metadata.sorted_tables:
    t.schema = schema

lines = [
    f"-- ============================================================",
    f"-- Service schema: {schema}",
    f"-- Generated from SQLAlchemy models (PostgreSQL dialect).",
    f"-- ============================================================",
    f'CREATE SCHEMA IF NOT EXISTS "{schema}";',
    "",
]
for t in Base.metadata.sorted_tables:
    ddl = str(CreateTable(t, if_not_exists=True).compile(dialect=dialect)).strip()
    lines.append(ddl.rstrip() + ";")
    lines.append("")

sys.stdout.write("\n".join(lines) + "\n")
