"""Lovify API configuration — loaded from mini-services/api/.env"""

from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    database_url: str = ""
    jwt_secret: str = "lovify-dev-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30 days
    ai_service_url: str = "http://localhost:8001"

    class Config:
        env_file = [str(BASE_DIR / ".env"), "/home/z/lovify.env"]
        env_file_encoding = "utf-8"
        extra = "ignore"

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        # The Next.js server injects the template's DATABASE_URL (SQLite) into
        # its process env, which we inherit when spawned as its child. Our own
        # .env file must win over inherited environment variables.
        return (
            init_settings,
            dotenv_settings,
            env_settings,
            file_secret_settings,
        )


settings = Settings()

if not settings.database_url:
    raise RuntimeError(
        "DATABASE_URL is not set. Create mini-services/api/.env (see .env.example)."
    )
