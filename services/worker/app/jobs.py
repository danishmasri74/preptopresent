"""Job handler registry.

Each job kind maps to a handler that receives the job payload and returns a result dict.
Handlers must be idempotent: a job may run more than once after a crash or retry.
"""

from collections.abc import Callable
from typing import Any

JobHandler = Callable[[dict[str, Any]], dict[str, Any]]

_HANDLERS: dict[str, JobHandler] = {}


class UnknownJobKindError(LookupError):
    pass


def job(kind: str) -> Callable[[JobHandler], JobHandler]:
    """Decorator that registers a handler for a job kind."""

    def register(fn: JobHandler) -> JobHandler:
        if kind in _HANDLERS:
            raise ValueError(f"Duplicate handler for job kind {kind!r}")
        _HANDLERS[kind] = fn
        return fn

    return register


def dispatch(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    handler = _HANDLERS.get(kind)
    if handler is None:
        raise UnknownJobKindError(kind)
    return handler(payload)


def registered_kinds() -> list[str]:
    return sorted(_HANDLERS)


@job("ping")
def ping(payload: dict[str, Any]) -> dict[str, Any]:
    """Phase 0 smoke-test job: proves web -> queue -> worker -> result works end to end."""
    return {"pong": True, "echo": payload.get("message", "")}
