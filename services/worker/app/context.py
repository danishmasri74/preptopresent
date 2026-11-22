"""What a job handler gets besides its payload."""

from dataclasses import dataclass, field
from typing import Any

import psycopg


@dataclass
class JobContext:
    conn: psycopg.Connection[dict[str, Any]] | None = None
    # Supabase client (storage access with the secret key). Created lazily by the runner.
    supabase: Any = None
    attempt: int = 1
    max_attempts: int = 1
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def is_last_attempt(self) -> bool:
        return self.attempt >= self.max_attempts
