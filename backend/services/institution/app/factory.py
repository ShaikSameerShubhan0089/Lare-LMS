from __future__ import annotations

from lare_common.app_factory import create_app
from lare_common.db import Database

from .config import InstitutionConfig
from .routes import bp
from .service import InstitutionService


def build_app():
    cfg = InstitutionConfig()
    db = Database(cfg.DATABASE_URL, echo=cfg.SQL_ECHO, schema=cfg.DB_SCHEMA)

    def ready() -> bool:
        try:
            with db.engine.connect() as c:
                c.exec_driver_sql("SELECT 1")
            return True
        except Exception:  # noqa: BLE001
            return False

    # Ensure tables exist (idempotent — creates only missing tables, e.g. the
    # new access_codes / access_sessions; never alters or drops existing ones).
    try:
        db.create_all()
    except Exception:  # noqa: BLE001 — never block startup on this
        pass

    # Blueprint carries full /lms/v1/... paths, so register at root.
    app = create_app(cfg, blueprints=[(bp, "")], ready_check=ready)
    app.extensions["db"] = db
    app.extensions["svc"] = InstitutionService()
    return app
