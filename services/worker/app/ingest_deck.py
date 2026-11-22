"""ingest_deck job: render and extract an uploaded PDF deck into slide rows + images (F-12)."""

import logging
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.context import JobContext
from app.jobs import job
from app.slides import DeckError, extract_pdf

log = logging.getLogger("worker.ingest_deck")

DECKS_BUCKET = "decks"
IMAGES_BUCKET = "slide-images"


class IngestDeckPayload(BaseModel):
    deck_id: UUID


def _set_status(ctx: JobContext, deck_id: UUID, status: str, error_code: str | None = None) -> None:
    assert ctx.conn is not None
    ctx.conn.execute(
        "update public.decks set status = %s, error_code = %s where id = %s",
        (status, error_code, deck_id),
    )


@job("ingest_deck")
def ingest_deck(payload: dict[str, Any], ctx: JobContext) -> dict[str, Any]:
    if ctx.conn is None or ctx.supabase is None:
        raise RuntimeError("ingest_deck needs a database connection and storage client")
    deck_id = IngestDeckPayload.model_validate(payload).deck_id

    deck = ctx.conn.execute(
        "select id, user_id, project_id, source_path from public.decks where id = %s",
        (deck_id,),
    ).fetchone()
    if deck is None:
        return {"skipped": "deck_not_found"}

    _set_status(ctx, deck_id, "processing")
    try:
        pdf_bytes = ctx.supabase.storage.from_(DECKS_BUCKET).download(deck["source_path"])
        slides = extract_pdf(pdf_bytes)

        prefix = f"{deck['user_id']}/{deck['project_id']}/{deck_id}"
        images = ctx.supabase.storage.from_(IMAGES_BUCKET)
        for s in slides:
            images.upload(
                f"{prefix}/{s.index:03d}.png",
                s.png,
                {"content-type": "image/png", "upsert": "true"},
            )

        # Replace any slides from an earlier attempt, then mark ready, atomically.
        with ctx.conn.transaction():
            ctx.conn.execute("delete from public.slides where deck_id = %s", (deck_id,))
            with ctx.conn.cursor() as cur:
                cur.executemany(
                    """insert into public.slides
                         (user_id, deck_id, index, title, body_text, visual_count,
                          image_path, content_hash)
                       values (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    [
                        (
                            deck["user_id"],
                            deck_id,
                            s.index,
                            s.title,
                            s.body_text,
                            s.visual_count,
                            f"{prefix}/{s.index:03d}.png",
                            s.content_hash,
                        )
                        for s in slides
                    ],
                )
            no_text = all(not s.body_text for s in slides)
            ctx.conn.execute(
                """update public.decks
                      set status = 'ready', page_count = %s, error_code = %s
                    where id = %s""",
                (len(slides), "no_text" if no_text else None, deck_id),
            )
    except DeckError as exc:
        # Permanent: tell the user, don't retry.
        log.info("deck %s rejected: %s", deck_id, exc.code)
        _set_status(ctx, deck_id, "failed", exc.code)
        return {"status": "failed", "error_code": exc.code}
    except Exception:
        # Transient (network, storage): let the runner retry; give up cleanly on the last try.
        if ctx.is_last_attempt:
            _set_status(ctx, deck_id, "failed", "internal")
        raise

    return {"status": "ready", "page_count": len(slides)}
