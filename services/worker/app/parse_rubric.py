"""parse_rubric job: read an uploaded or pasted rubric into criteria rows (F-14, architecture §6).

Safe to retry: criteria from an earlier attempt are replaced in one transaction.
"""

import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb
from pydantic import BaseModel

from app import ai
from app.config import get_settings
from app.context import JobContext
from app.jobs import job
from app.prompts import parse_rubric as prompt
from app.rubric_source import RubricFileError, from_file, from_paste

log = logging.getLogger("worker.parse_rubric")

RUBRICS_BUCKET = "rubrics"
MAX_CRITERIA = 20
MAX_LEVELS = 6


class ParseRubricPayload(BaseModel):
    rubric_id: UUID


@dataclass(frozen=True)
class Criterion:
    name: str
    weight: float  # percent
    description: str
    levels: list[dict[str, str]]


def normalise(data: dict[str, Any]) -> tuple[list[Criterion], bool]:
    """Clean the model's answer into percentage criteria. Returns (criteria, weights_suggested)."""
    if not data.get("is_rubric"):
        return [], False
    unit = data.get("weight_unit", "percent")
    raw = [c for c in data.get("criteria", []) if str(c.get("name", "")).strip()][:MAX_CRITERIA]
    weights = [max(0.0, float(c.get("weight") or 0)) for c in raw]

    if unit == "points":
        total = sum(weights)
        if total > 0:
            weights = [round(w / total * 100, 2) for w in weights]
            # Give any rounding remainder to the last criterion so converted weights total 100.
            weights[-1] = round(100 - sum(weights[:-1]), 2)
    weights = [min(100.0, max(0.0, round(w, 2))) for w in weights]

    criteria = [
        Criterion(
            name=" ".join(str(c["name"]).split())[:120],
            weight=w,
            description=" ".join(str(c.get("description", "")).split())[:2000],
            levels=[
                {"label": str(lv.get("label", ""))[:60], "text": str(lv.get("text", ""))[:500]}
                for lv in (c.get("levels") or [])[:MAX_LEVELS]
                if str(lv.get("text", "")).strip()
            ],
        )
        for c, w in zip(raw, weights, strict=True)
    ]
    return criteria, unit == "none"


def _fail(ctx: JobContext, rubric_id: UUID, code: str) -> dict[str, Any]:
    assert ctx.conn is not None
    ctx.conn.execute(
        "update public.rubrics set status = 'failed', error_code = %s where id = %s",
        (code, rubric_id),
    )
    return {"status": "failed", "error_code": code}


@job("parse_rubric")
def parse_rubric(payload: dict[str, Any], ctx: JobContext) -> dict[str, Any]:
    if ctx.conn is None:
        raise RuntimeError("parse_rubric needs a database connection")
    rubric_id = ParseRubricPayload.model_validate(payload).rubric_id
    settings = ctx.extra.get("settings") or get_settings()

    row = ctx.conn.execute(
        """select id, user_id, source_kind, source_path, mime_type, pasted_text
             from public.rubrics where id = %s""",
        (rubric_id,),
    ).fetchone()
    if row is None:
        return {"skipped": "rubric_not_found"}

    ctx.conn.execute(
        "update public.rubrics set status = 'processing', error_code = null where id = %s",
        (rubric_id,),
    )
    try:
        if row["source_kind"] == "paste":
            source = from_paste(row["pasted_text"] or "")
        else:
            if ctx.supabase is None:
                raise RuntimeError("parse_rubric needs a storage client for file uploads")
            data = ctx.supabase.storage.from_(RUBRICS_BUCKET).download(row["source_path"])
            source = from_file(data, row["mime_type"])

        if settings.ai_mode == "mock":
            result = ai.mock_read_rubric(source.text, bool(source.images))
        else:
            result = ai.structured_call(
                settings=settings,
                schema_name="parse-rubric",
                system=prompt.SYSTEM,
                user_text=prompt.user_text(source.text, bool(source.images)),
                images=source.images,
                effort="medium",
                client=ctx.extra.get("ai_client"),
            )
    except RubricFileError as exc:
        log.info("rubric %s rejected: %s", rubric_id, exc.code)
        return _fail(ctx, rubric_id, exc.code)
    except ai.AiError as exc:
        if exc.retryable and not ctx.is_last_attempt:
            raise
        log.warning("rubric %s: AI error %s: %s", rubric_id, exc.code, exc)
        return _fail(ctx, rubric_id, "refused" if exc.code == "refused" else "internal")
    except Exception:
        # Transient (network, storage): let the runner retry; give up cleanly on the last try.
        if ctx.is_last_attempt:
            _fail(ctx, rubric_id, "internal")
        raise

    criteria, suggested = normalise(result.data)
    with ctx.conn.transaction():
        ctx.conn.execute("delete from public.rubric_criteria where rubric_id = %s", (rubric_id,))
        if criteria:
            with ctx.conn.cursor() as cur:
                cur.executemany(
                    """insert into public.rubric_criteria
                         (user_id, rubric_id, position, name, weight, description, levels)
                       values (%s, %s, %s, %s, %s, %s, %s)""",
                    [
                        (
                            row["user_id"],
                            rubric_id,
                            i,
                            c.name,
                            c.weight,
                            c.description,
                            Jsonb(c.levels),
                        )
                        for i, c in enumerate(criteria, start=1)
                    ],
                )
        ctx.conn.execute(
            """update public.rubrics
                  set status = %s, error_code = %s, raw_text = %s, weights_suggested = %s,
                      model = %s, prompt_version = %s
                where id = %s""",
            (
                "parsed" if criteria else "failed",
                None if criteria else "not_a_rubric",
                source.text or None,
                suggested,
                result.model,
                prompt.PROMPT_VERSION,
                rubric_id,
            ),
        )
        if result.model != ai.MOCK_MODEL:
            u = result.usage
            ctx.conn.execute(
                """insert into public.usage_events
                     (user_id, action, job_id, provider, model, prompt_version, input_tokens,
                      output_tokens, cache_read_tokens, cache_write_tokens, cost_usd)
                   values (%s, 'rubric_read', %s, 'anthropic', %s, %s, %s, %s, %s, %s, %s)""",
                (
                    row["user_id"],
                    ctx.extra.get("job_id"),
                    result.model,
                    prompt.PROMPT_VERSION,
                    u.input_tokens,
                    u.output_tokens,
                    u.cache_read_tokens,
                    u.cache_write_tokens,
                    u.cost_usd(),
                ),
            )

    return {"status": "parsed" if criteria else "failed", "criteria": len(criteria)}
