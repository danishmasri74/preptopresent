import pymupdf
import pytest

from app.slides import DeckError, extract_pdf


def make_pdf(pages: list[tuple[str, str]]) -> bytes:
    """Build a 16:9 PDF where each page has a large title and smaller body text."""
    doc = pymupdf.open()
    for title, body in pages:
        page = doc.new_page(width=960, height=540)
        page.insert_text((60, 90), title, fontsize=36)
        if body:
            page.insert_text((60, 200), body, fontsize=18)
    data = doc.tobytes()
    doc.close()
    return data


def test_extracts_titles_text_images_and_hashes() -> None:
    pdf = make_pdf([("Methodology", "Agile, four sprints"), ("Results", "SUS score 78")])
    slides = extract_pdf(pdf)

    assert [s.index for s in slides] == [1, 2]
    assert [s.title for s in slides] == ["Methodology", "Results"]
    assert "Agile, four sprints" in slides[0].body_text
    assert slides[0].png.startswith(b"\x89PNG")
    assert slides[0].content_hash != slides[1].content_hash


def test_content_hash_is_stable_for_identical_slides() -> None:
    a = extract_pdf(make_pdf([("Intro", "Hello")]))[0]
    b = extract_pdf(make_pdf([("Intro", "Hello")]))[0]
    assert a.content_hash == b.content_hash


def test_rejects_non_pdf_bytes() -> None:
    with pytest.raises(DeckError) as err:
        extract_pdf(b"this is not a pdf")
    assert err.value.code == "unreadable"


def test_rejects_too_many_pages() -> None:
    with pytest.raises(DeckError) as err:
        extract_pdf(make_pdf([("Slide", "")] * 3), max_pages=2)
    assert err.value.code == "too_many_pages"


def test_blank_slide_still_gets_an_image_and_hash() -> None:
    doc = pymupdf.open()
    doc.new_page(width=960, height=540)
    slides = extract_pdf(doc.tobytes())
    assert slides[0].title is None
    assert slides[0].body_text == ""
    assert slides[0].png.startswith(b"\x89PNG")
    assert len(slides[0].content_hash) == 64
