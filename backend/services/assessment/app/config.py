import os

from lare_common.config import BaseConfig


class AssessmentConfig(BaseConfig):
    SERVICE_NAME = os.getenv("SERVICE_NAME", "lms-assessment")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///assessment.sqlite3")
    DB_SCHEMA = os.getenv("DB_SCHEMA", "lms_assessment") or None
