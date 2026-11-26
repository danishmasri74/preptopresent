"""Turn an uploaded rubric (PDF, DOCX, image) or pasted text into text and/or page images.

Pure functions: bytes in, RubricSource out. No I/O, easy to test.
"""

import io
import re
import zipfile
from dataclasses import dataclass, field

import docx
import pymupdf

MAX_PAGES = 20
MAX_TEXT_CHARS = 50_000
# Image pages sent to Claude vision when a file has no extractable text.
MAX_IMAGE_PAGES = 5
IMAGE_LONG_SIDE_PX = 1600
# Below this many characters a PDF is treated as scanned.
MIN_TEXT_CHARS = 40

PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class RubricFileError(Exception):
    """A permanent problem with the uploaded file (retrying won't help)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class RubricSource:
    text: str
    # PNG bytes of pages or photos to read with vision, when there is little or no text.
    images: list[bytes] = field(default_factory=list)


def _tidy(text: str) -> str:
    text = text.replace("\r\n", "\n").replace(" ", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:MAX_TEXT_CHARS]


def _png(page: pymupdf.Page) -> bytes:
    scale = IMAGE_LONG_SIDE_PX / max(page.rect.width, page.rect.height)
    return page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False).tobytes("png")


def _from_pdf(data: bytes) -> RubricSource:
    if not data.startswith(b"%PDF"):
        raise RubricFileError("unreadable", "not a PDF")
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001 - any parse failure means an unreadable file
        raise RubricFileError("unreadable", "PDF could not be opened") from exc
    with doc:
        if doc.needs_pass:
            raise RubricFileError("encrypted", "PDF is password-protected")
        if doc.page_count == 0:
            raise RubricFileError("empty", "PDF has no pages")
        if doc.page_count > MAX_PAGES:
            raise RubricFileError("too_many_pages", f"{doc.page_count} pages")
        text = _tidy("\n\n".join(page.get_text() for page in doc))
        if len(text) >= MIN_TEXT_CHARS:
            return RubricSource(text=text)
        # Scanned: read the first pages with vision instead.
        images = [_png(doc[i]) for i in range(min(doc.page_count, MAX_IMAGE_PAGES))]
        return RubricSource(text=text, images=images)


def _from_docx(data: bytes) -> RubricSource:
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise RubricFileError("unreadable", "not a DOCX")
    try:
        document = docx.Document(io.BytesIO(data))
    except Exception as exc:  # noqa: BLE001
        raise RubricFileError("unreadable", "DOCX could not be opened") from exc
    parts: list[str] = [p.text for p in document.paragraphs if p.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells: list[str] = []
            for cell in row.cells:
                value = " ".join(cell.text.split())
                if value and (not cells or cells[-1] != value):  # merged cells repeat
                    cells.append(value)
            if cells:
                parts.append(" | ".join(cells))
    text = _tidy("\n".join(parts))
    if not text:
        raise RubricFileError("empty", "DOCX has no text")
    return RubricSource(text=text)


def _from_image(data: bytes, mime_type: str) -> RubricSource:
    try:
        doc = pymupdf.open(stream=data, filetype=IMAGE_TYPES[mime_type])
        with doc:
            return RubricSource(text="", images=[_png(doc[0])])
    except Exception as exc:  # noqa: BLE001
        raise RubricFileError("unreadable", "image could not be opened") from exc


def from_file(data: bytes, mime_type: str) -> RubricSource:
    if not data:
        raise RubricFileError("empty", "empty file")
    if mime_type == PDF:
        return _from_pdf(data)
    if mime_type == DOCX:
        return _from_docx(data)
    if mime_type in IMAGE_TYPES:
        return _from_image(data, mime_type)
    raise RubricFileError("unsupported", f"unsupported type {mime_type}")


def from_paste(text: str) -> RubricSource:
    tidy = _tidy(text)
    if not tidy:
        raise RubricFileError("empty", "no text")
    return RubricSource(text=tidy)
