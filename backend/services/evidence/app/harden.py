"""Database-level immutability for the evidence ledger.

The app layer never issues UPDATE/DELETE on ``evidence``; this makes that a
hard guarantee on PostgreSQL by installing a trigger that raises on any UPDATE
or DELETE. ``evidence_conflicts`` stays mutable (conflicts are resolved).
On SQLite (local dev) this is a no-op. Failures (e.g. missing privilege) are
logged and non-fatal so init-db still succeeds.
"""
from __future__ import annotations

import logging

log = logging.getLogger("lare-evidence")


def install_immutability(db) -> bool:
    if getattr(db, "is_sqlite", True):
        return False
    sch = db.schema
    fn = f'"{sch}".evidence_immutable' if sch else "evidence_immutable"
    tbl = f'"{sch}".evidence' if sch else "evidence"
    stmts = [
        f"CREATE OR REPLACE FUNCTION {fn}() RETURNS trigger AS $BODY$ "
        f"BEGIN RAISE EXCEPTION 'evidence ledger is append-only (% blocked)', TG_OP; END; "
        f"$BODY$ LANGUAGE plpgsql;",
        f"DROP TRIGGER IF EXISTS evidence_no_mutate ON {tbl};",
        f"CREATE TRIGGER evidence_no_mutate BEFORE UPDATE OR DELETE ON {tbl} "
        f"FOR EACH ROW EXECUTE FUNCTION {fn}();",
        # Second layer: remove UPDATE/DELETE from PUBLIC. The trigger is the hard
        # guard (a table-owner role bypasses grants), but this closes non-owner paths.
        f"REVOKE UPDATE, DELETE ON {tbl} FROM PUBLIC;",
    ]
    try:
        with db.engine.begin() as c:
            for st in stmts:
                c.exec_driver_sql(st)
        log.info("evidence immutability trigger installed on %s", tbl)
        return True
    except Exception as exc:  # noqa: BLE001 — non-fatal hardening step
        log.warning("could not install evidence immutability trigger: %s", exc)
        return False
