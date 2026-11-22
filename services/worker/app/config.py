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
    # Supabase project URL + secret key: used for Storage (download decks, upload slide images).
    supabase_url: str | None = None
    supabase_secret_key: SecretStr | None = None
    # Provider keys: only needed once the matching jobs exist (Phase 1+).
    anthropic_api_key: SecretStr | None = None
    # ElevenLabs: Scribe v3 transcription and Eleven v4 examiner voices (one key).
    elevenlabs_api_key: SecretStr | None = None
    # Cloudflare R2 (rehearsal videos): the worker only deletes videos (delete_media job).
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: SecretStr | None = None
    r2_bucket: str = "rehearsal-videos"


@lru_cache
def get_settings() -> Settings:
    return Settings()
