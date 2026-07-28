import os

from lare_common.config import BaseConfig


class InstitutionConfig(BaseConfig):
    SERVICE_NAME = os.getenv("SERVICE_NAME", "lms-institution")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///institution.sqlite3")
    DB_SCHEMA = os.getenv("DB_SCHEMA", "lms_institution") or None
