import os

from lare_common.config import BaseConfig


class TutorConfig(BaseConfig):
    SERVICE_NAME = os.getenv("SERVICE_NAME", "lms-tutor")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///ai_tutor.sqlite3")
    DB_SCHEMA = os.getenv("DB_SCHEMA", "lms_tutor") or None
