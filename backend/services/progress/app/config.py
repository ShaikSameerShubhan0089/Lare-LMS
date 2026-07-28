import os

from lare_common.config import BaseConfig


class ProgressConfig(BaseConfig):
    SERVICE_NAME = os.getenv("SERVICE_NAME", "lms-progress")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///progress.sqlite3")
    DB_SCHEMA = os.getenv("DB_SCHEMA", "lms_progress") or None
    # Year completion threshold (default from MoU is 60%).
    PASSING_THRESHOLD = int(os.getenv("PASSING_THRESHOLD", "60"))
