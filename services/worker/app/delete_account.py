"""delete_account job: permanently remove a user's files and account (F-06, architecture §8).

Queued only by request_account_deletion() in Postgres (users can't enqueue it directly), so the
user id in the payload is trusted. Safe to retry: every step skips what is already gone.
"""

import logging
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.context import JobContext
from app.jobs import job

log = logging.getLogger("worker.delete_account")

# Every private Storage bucket that holds files under "<user_id>/...". Buckets that don't exist
# yet (recordings, qa-audio arrive in later phases) simply have no rows.
USER_BUCKETS = ("decks", "slide-images", "rubrics", "recordings", "qa-audio")
# The Storage API accepts up to 1000 paths per remove call.
REMOVE_BATCH = 1000


class DeleteAccountPayload(BaseModel):
    user_id: UUID


def _user_objects(ctx: JobContext, user_id: UUID) -> dict[str, list[str]]:
    """Stored file paths per bucket. Read from storage.objects, which lists nested folders too."""
    assert ctx.conn is not None
    rows = ctx.conn.execute(
        """select bucket_id, name from storage.objects
            where bucket_id = any(%s) and name like %s""",
        (list(USER_BUCKETS), f"{user_id}/%"),
    ).fetchall()
    found: dict[str, list[str]] = {}
    for row in rows:
        found.setdefault(row["bucket_id"], []).append(row["name"])
    return found


def _is_user_not_found(exc: Exception) -> bool:
    status = getattr(exc, "status", None)
    return status == 404 or "not found" in str(exc).lower()


@job("delete_account")
def delete_account(payload: dict[str, Any], ctx: JobContext) -> dict[str, Any]:
    if ctx.conn is None or ctx.supabase is None:
        raise RuntimeError("delete_account needs a database connection and storage client")
    user_id = DeleteAccountPayload.model_validate(payload).user_id

    # 1. Files first: rows cascade away with the user, but Storage objects don't.
    removed = 0
    for bucket, paths in _user_objects(ctx, user_id).items():
        storage = ctx.supabase.storage.from_(bucket)
        for i in range(0, len(paths), REMOVE_BATCH):
            storage.remove(paths[i : i + REMOVE_BATCH])
            removed += len(paths[i : i + REMOVE_BATCH])

    # Phase 3: delete rehearsal videos under "<user_id>/" in R2 here, before the user row goes.

    # 2. The auth user. Every user-owned table references auth.users with ON DELETE CASCADE.
    try:
        ctx.supabase.auth.admin.delete_user(str(user_id))
    except Exception as exc:
        if not _is_user_not_found(exc):
            raise
        log.info("user %s already deleted", user_id)

    log.info("deleted account %s (%d files)", user_id, removed)
    return {"files_removed": removed}
