import os

from lare_common.config import BaseConfig


class LearnerConfig(BaseConfig):
    SERVICE_NAME = os.getenv("SERVICE_NAME", "lms-learner")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///learner.sqlite3")
    DB_SCHEMA = os.getenv("DB_SCHEMA", "lms_learner") or None
