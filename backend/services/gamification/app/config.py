import os

from lare_common.config import BaseConfig


class GamificationConfig(BaseConfig):
    SERVICE_NAME = os.getenv("SERVICE_NAME", "lms-gamification")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///gamification.sqlite3")
    DB_SCHEMA = os.getenv("DB_SCHEMA", "lms_gamification") or None
