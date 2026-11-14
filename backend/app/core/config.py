from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    database_url: str = Field(validation_alias="DATABASE_URL")
    database_url_unpooled: str | None = Field(
        default=None,
        validation_alias="DATABASE_URL_UNPOOLED",
    )
    redis_url: str | None = Field(default=None, validation_alias="REDIS_URL")
    llm_provider: str | None = Field(default=None, validation_alias="LLM_PROVIDER")
    llm_api_key: str | None = Field(default=None, validation_alias="LLM_API_KEY")
    frontend_url: str = Field(
        default="http://localhost:5173",
        validation_alias="FRONTEND_URL",
    )
    app_env: str = Field(default="development", validation_alias="APP_ENV")

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def sqlalchemy_database_url(self) -> URL:
        return self._psycopg_url(self.database_url)

    @property
    def migration_sqlalchemy_database_url(self) -> URL:
        return self._psycopg_url(self.database_url_unpooled or self.database_url)

    @staticmethod
    def _psycopg_url(value: str) -> URL:
        url = make_url(value)
        if url.drivername in {"postgres", "postgresql"}:
            url = url.set(drivername="postgresql+psycopg")
        elif url.drivername == "postgresql+psycopg2":
            url = url.set(drivername="postgresql+psycopg")
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
