import os

from lare_common.config import BaseConfig


class CurriculumConfig(BaseConfig):
    SERVICE_NAME = os.getenv("SERVICE_NAME", "lms-curriculum")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///curriculum.sqlite3")
    DB_SCHEMA = os.getenv("DB_SCHEMA", "lms_curriculum") or None
