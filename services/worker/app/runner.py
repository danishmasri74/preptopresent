"""Postgres-backed job runner.

Claims one queued job at a time with FOR UPDATE SKIP LOCKED, so several worker processes can
run safely in parallel. Failed jobs are retried with backoff until max_attempts is reached.
"""

import logging
import time
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from supabase import create_client

from app.config import get_settings
from app.context import JobContext
from app.jobs import dispatch

log = logging.getLogger("worker.runner")

CLAIM_SQL = """
update public.jobs
   set status = 'running', attempts = attempts + 1, started_at = now(), updated_at = now()
 where id = (
   select id from public.jobs
    where status = 'queued' and run_after <= now()
    order by created_at
    for update skip locked
    limit 1
 )
returning id, kind, payload, attempts, max_attempts
"""

COMPLETE_SQL = """
update public.jobs
   set status = 'succeeded', result = %(result)s, error = null,
       finished_at = now(), updated_at = now()
 where id = %(id)s
"""

FAIL_SQL = """
update public.jobs
   set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
       run_after = now() + make_interval(secs => least(300, 5 * power(2, attempts))),
       error = %(error)s, updated_at = now()
 where id = %(id)s
"""


def run_once(conn: psycopg.Connection[dict[str, Any]], supabase: Any = None) -> bool:
    """Claim and run a single job. Returns True if a job was processed."""
    with conn.transaction():
        row = conn.execute(CLAIM_SQL).fetchone()
    if row is None:
        return False

    log.info("job %s (%s) attempt %s", row["id"], row["kind"], row["attempts"])
    ctx = JobContext(
        conn=conn, supabase=supabase, attempt=row["attempts"], max_attempts=row["max_attempts"]
    )
    try:
        result = dispatch(row["kind"], row["payload"] or {}, ctx)
    except Exception as exc:  # noqa: BLE001 - any handler failure is recorded and retried
        log.exception("job %s failed", row["id"])
        with conn.transaction():
            conn.execute(
                FAIL_SQL, {"id": row["id"], "error": f"{type(exc).__name__}: {exc}"[:2000]}
            )
        return True

    with conn.transaction():
        conn.execute(COMPLETE_SQL, {"id": row["id"], "result": Jsonb(result)})
    return True


def run_forever() -> None:
    settings = get_settings()
    if settings.database_url is None:
        raise SystemExit("DATABASE_URL is not set; see services/worker/.env.example")

    if settings.supabase_url is None or settings.supabase_secret_key is None:
        raise SystemExit("SUPABASE_URL / SUPABASE_SECRET_KEY are not set; see .env.example")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    supabase = create_client(settings.supabase_url, settings.supabase_secret_key.get_secret_value())
    with psycopg.connect(
        settings.database_url.get_secret_value(), row_factory=dict_row, autocommit=True
    ) as conn:
        log.info("worker started")
        while True:
            if not run_once(conn, supabase):
                time.sleep(settings.poll_interval_s)


if __name__ == "__main__":
    run_forever()
