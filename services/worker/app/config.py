"""Worker settings, read from environment variables (never hard-code secrets)."""

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    # Postgres connection string for the Supabase database (session pooler URL).
    database_url: SecretStr | None = None
    # Seconds between queue polls when idle.
    poll_interval_s: float = 2.0
    # Provider keys: only needed once the matching jobs exist (Phase 1+).
    anthropic_api_key: SecretStr | None = None
    deepgram_api_key: SecretStr | None = None
    elevenlabs_api_key: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
