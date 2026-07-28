import os

from lare_common.config import BaseConfig


class ContentConfig(BaseConfig):
    SERVICE_NAME = os.getenv("SERVICE_NAME", "lms-content")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///content.sqlite3")
    DB_SCHEMA = os.getenv("DB_SCHEMA", "lms_content") or None
