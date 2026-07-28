import os

from lare_common.config import BaseConfig


class CertificationConfig(BaseConfig):
    SERVICE_NAME = os.getenv("SERVICE_NAME", "lms-certification")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///certification.sqlite3")
    DB_SCHEMA = os.getenv("DB_SCHEMA", "lms_certification") or None
