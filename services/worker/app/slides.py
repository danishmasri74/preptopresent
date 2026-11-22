"""Pure PDF slide extraction: bytes in, per-slide image + text out. No I/O, easy to test."""

import hashlib
import re
from dataclasses import dataclass

import pymupdf

MAX_PAGES = 60
RENDER_WIDTH_PX = 1280


class DeckError(Exception):
    """A permanent problem with the uploaded file (retrying won't help)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ExtractedSlide:
    index: int  # 1-based
    title: str | None
    body_text: str
    visual_count: int
    png: bytes
    content_hash: str


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _guess_title(page: pymupdf.Page) -> str | None:
    """Largest-font line in the top 40% of the slide, falling back to the first text line."""
    data = page.get_text("dict")
    cutoff = page.rect.y0 + page.rect.height * 0.4
    best_size = 0.0
    best: list[str] = []
    first_line: str | None = None
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
            if not spans:
                continue
            text = _normalise(" ".join(s["text"] for s in spans))
            if first_line is None:
                first_line = text
            if line["bbox"][1] > cutoff:
                continue
            size = max(s.get("size", 0.0) for s in spans)
            if size > best_size + 0.5:
                best_size, best = size, [text]
            elif abs(size - best_size) <= 0.5:
                best.append(text)
    title = " ".join(best) if best else first_line
    return title[:200] if title else None


def extract_pdf(pdf_bytes: bytes, *, max_pages: int = MAX_PAGES) -> list[ExtractedSlide]:
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:  # noqa: BLE001 - any parse failure means an unreadable file
        raise DeckError("unreadable", "The file could not be opened as a PDF.") from exc

    with doc:
        if doc.needs_pass:
            raise DeckError("encrypted", "The PDF is password-protected.")
        if doc.page_count == 0:
            raise DeckError("empty", "The PDF has no pages.")
        if doc.page_count > max_pages:
            raise DeckError("too_many_pages", f"The deck has more than {max_pages} slides.")

        slides: list[ExtractedSlide] = []
        for i, page in enumerate(doc, start=1):
            body = _normalise(page.get_text("text"))
            zoom = RENDER_WIDTH_PX / page.rect.width if page.rect.width else 1.0
            png = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False).tobytes("png")
            fingerprint = body.encode() if body else png
            slides.append(
                ExtractedSlide(
                    index=i,
                    title=_guess_title(page),
                    body_text=body,
                    visual_count=len(page.get_images(full=False)),
                    png=png,
                    content_hash=hashlib.sha256(fingerprint).hexdigest(),
                )
            )
        return slides
