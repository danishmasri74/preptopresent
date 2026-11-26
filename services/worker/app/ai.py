"""Claude API access for worker jobs (architecture §7), with a mock mode.

Mock mode (AI_MODE=mock) answers without calling the API, so screens, tests and the full job
flow work with no key and no cost. Mock results are stored with model "mock" so the app can
label them; they are never a substitute for a real reading.
"""

import base64
import json
import logging
import re
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path
from typing import Any

import anthropic

from app.config import Settings

log = logging.getLogger("worker.ai")

MODEL = "claude-opus-5-5"
MOCK_MODEL = "mock"
# Server-side fallback on refusals (routes by refusal category; no model list to maintain).
FALLBACK_BETA = "server-side-fallback-2026-07-01"
# USD per million tokens for MODEL: input, output, cache read, cache write (5-minute TTL).
PRICES = {"input": 4.00, "output": 20.00, "cache_read": 0.20, "cache_write": 5.00}

SCHEMAS = Path(__file__).resolve().parents[3] / "packages" / "schemas" / "ai"


class AiError(Exception):
    """The AI call failed. `retryable` errors are retried by the job runner."""

    def __init__(self, code: str, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable


@dataclass(frozen=True)
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0

    def cost_usd(self) -> float:
        return round(
            (
                self.input_tokens * PRICES["input"]
                + self.output_tokens * PRICES["output"]
                + self.cache_read_tokens * PRICES["cache_read"]
                + self.cache_write_tokens * PRICES["cache_write"]
            )
            / 1_000_000,
            5,
        )


@dataclass(frozen=True)
class AiResult:
    data: dict[str, Any]
    model: str
    usage: Usage = field(default_factory=Usage)


@cache
def load_schema(name: str) -> dict[str, Any]:
    schema = json.loads((SCHEMAS / f"{name}.output.schema.json").read_text(encoding="utf-8"))
    # Structured outputs take the schema body; drop JSON Schema metadata keys.
    return {k: v for k, v in schema.items() if not k.startswith("$")}


def _client(settings: Settings) -> anthropic.Anthropic:
    if settings.anthropic_api_key is None:
        raise AiError("not_configured", "ANTHROPIC_API_KEY is not set", retryable=False)
    return anthropic.Anthropic(api_key=settings.anthropic_api_key.get_secret_value())


def structured_call(
    *,
    settings: Settings,
    schema_name: str,
    system: str,
    user_text: str,
    images: list[bytes] | None = None,
    effort: str = "medium",
    max_tokens: int = 16000,
    client: Any = None,
) -> AiResult:
    """One Claude request whose answer must match a JSON Schema from packages/schemas/ai."""
    content: list[dict[str, Any]] = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": base64.standard_b64encode(png).decode("ascii"),
            },
        }
        for png in images or []
    ]
    content.append({"type": "text", "text": user_text})

    client = client or _client(settings)
    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            thinking={"type": "adaptive"},
            output_config={
                "effort": effort,
                "format": {"type": "json_schema", "schema": load_schema(schema_name)},
            },
            system=system,
            messages=[{"role": "user", "content": content}],
        )
    except (anthropic.RateLimitError, anthropic.InternalServerError) as exc:
        raise AiError("provider_busy", str(exc), retryable=True) from exc
    except anthropic.APIConnectionError as exc:
        raise AiError("provider_unreachable", str(exc), retryable=True) from exc
    except anthropic.APIStatusError as exc:
        # 400/401/403/404 won't fix themselves; 5xx are covered above.
        raise AiError(
            "provider_rejected", f"{exc.status_code}: {exc.message}", retryable=False
        ) from exc

    u = response.usage
    usage = Usage(
        input_tokens=u.input_tokens or 0,
        output_tokens=u.output_tokens or 0,
        cache_read_tokens=getattr(u, "cache_read_input_tokens", 0) or 0,
        cache_write_tokens=getattr(u, "cache_creation_input_tokens", 0) or 0,
    )
    log.info(
        "claude %s: %s in / %s out tokens, ~$%s",
        response.model,
        usage.input_tokens,
        usage.output_tokens,
        usage.cost_usd(),
    )

    # Check why the model stopped before reading the content.
    if response.stop_reason == "refusal":
        raise AiError("refused", "the model declined this document", retryable=False)
    if response.stop_reason == "max_tokens":
        raise AiError("too_long", "the answer hit max_tokens", retryable=False)
    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        raise AiError(
            "no_output", f"no text block (stop_reason {response.stop_reason})", retryable=True
        )
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AiError("bad_output", "answer was not valid JSON", retryable=True) from exc
    return AiResult(data=data, model=response.model, usage=usage)


# ---------------------------------------------------------------------------
# Mock answers
# ---------------------------------------------------------------------------

_INLINE = re.compile(
    r"^\s*(?:\d+[.)]\s*)?(?P<name>[A-Za-z][^\n%]{1,80}?)\s*[-–:]\s*(?P<w>\d{1,3}(?:\.\d+)?)\s*%\s*$"
)
_WEIGHT_ALONE = re.compile(r"^\s*(?P<w>\d{1,3}(?:\.\d+)?)\s*(?P<pct>%)?\s*$")
_HEADER_WORDS = {"criterion", "criteria", "weight", "points", "marks", "total"}

# Shown for images in mock mode, which can't actually be read without the API.
_SAMPLE = {
    "is_rubric": True,
    "weight_unit": "percent",
    "criteria": [
        {"name": "Problem statement & objectives", "weight": 20, "description": "", "levels": []},
        {"name": "Methodology", "weight": 25, "description": "", "levels": []},
        {"name": "Results & evaluation", "weight": 25, "description": "", "levels": []},
        {"name": "Delivery", "weight": 20, "description": "", "levels": []},
        {"name": "Q&A", "weight": 10, "description": "", "levels": []},
    ],
    "notes": "Test mode: this is a sample result, not a reading of your image.",
}


def mock_read_rubric(text: str, has_images: bool) -> AiResult:
    """Rough, rule-based stand-in for the real reading (good enough for the sample rubrics)."""
    if not text.strip():
        return AiResult(data=dict(_SAMPLE) if has_images else _not_rubric(), model=MOCK_MODEL)

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    criteria: list[dict[str, Any]] = []
    unit = "percent"

    # "1. Introduction and objectives - 15%" followed by description lines.
    for i, line in enumerate(lines):
        m = _INLINE.match(line)
        if not m or m["name"].strip().lower() in _HEADER_WORDS:
            continue
        description: list[str] = []
        for nxt in lines[i + 1 :]:
            if _INLINE.match(nxt) or nxt.lower().startswith("total"):
                break
            description.append(nxt)
        criteria.append(_criterion(m["name"], float(m["w"]), " ".join(description)))

    # Word table rows: "Methodology | 25% | level text | ...".
    if not criteria:
        for line in lines:
            cells = [c.strip() for c in line.split("|")]
            if len(cells) < 2 or cells[0].lower() in _HEADER_WORDS:
                continue
            m = _WEIGHT_ALONE.match(cells[1])
            if m:
                unit = "percent" if m["pct"] else "points"
                criteria.append(
                    _criterion(cells[0], float(m["w"]), cells[2] if len(cells) > 2 else "")
                )

    # Table text: a criterion name line, then its weight on a line of its own.
    if not criteria:
        for i, line in enumerate(lines):
            m = _WEIGHT_ALONE.match(line)
            if not m or i == 0:
                continue
            name = lines[i - 1]
            if name.lower() in _HEADER_WORDS or _WEIGHT_ALONE.match(name):
                continue
            if name[:1].islower() and i >= 2:  # name wrapped onto two lines
                name = f"{lines[i - 2]} {name}"
            unit = "percent" if m["pct"] else "points"
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            criteria.append(_criterion(name, float(m["w"]), nxt))

    if not criteria:
        return AiResult(data=_not_rubric(), model=MOCK_MODEL)
    return AiResult(
        data={"is_rubric": True, "weight_unit": unit, "criteria": criteria, "notes": ""},
        model=MOCK_MODEL,
    )


def _criterion(name: str, weight: float, description: str) -> dict[str, Any]:
    return {"name": name.strip(" -–:"), "weight": weight, "description": description, "levels": []}


def _not_rubric() -> dict[str, Any]:
    return {"is_rubric": False, "weight_unit": "none", "criteria": [], "notes": ""}
