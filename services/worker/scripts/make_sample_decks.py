"""Generate sample slide decks for manual and automated testing.

Usage (from services/worker):
    uv run python scripts/make_sample_decks.py            # writes to ../../samples/decks

Produces realistic decks plus one file per error state the app must handle.
"""

import sys
from pathlib import Path

import pymupdf

OUT = Path(__file__).resolve().parents[3] / "samples" / "decks"

INDIGO = (0x38 / 255, 0x46 / 255, 0xC4 / 255)
NAVY = (0x1E / 255, 0x2A / 255, 0x78 / 255)
AMBER = (0xC2 / 255, 0x5E / 255, 0x14 / 255)
INK = (0x15 / 255, 0x17 / 255, 0x1C / 255)
MUTED = (0x5A / 255, 0x60 / 255, 0x6C / 255)
SOFT = (0xEC / 255, 0xEE / 255, 0xFC / 255)
WHITE = (1, 1, 1)


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------
def new_slide(doc: pymupdf.Document, w: float, h: float, title: str | None) -> pymupdf.Page:
    page = doc.new_page(width=w, height=h)
    page.draw_rect(pymupdf.Rect(0, 0, w, 8), color=None, fill=INDIGO)
    if title:
        page.insert_textbox(
            pymupdf.Rect(48, 36, w - 48, 100), title, fontsize=30, fontname="hebo", color=NAVY
        )
    return page


def bullets(page: pymupdf.Page, items: list[str], top: float = 120, size: float = 18) -> None:
    w = page.rect.width
    y = top
    for item in items:
        page.draw_circle(pymupdf.Point(60, y + size * 0.55), 3.5, color=None, fill=INDIGO)
        rect = pymupdf.Rect(76, y, w - 60, y + size * 3)
        page.insert_textbox(rect, item, fontsize=size, fontname="helv", color=INK)
        y += size * 2.1


def footer(page: pymupdf.Page, text: str, n: int) -> None:
    w, h = page.rect.width, page.rect.height
    page.insert_text((48, h - 22), text, fontsize=9, color=MUTED)
    page.insert_text((w - 60, h - 22), str(n), fontsize=9, color=MUTED)


def box(page: pymupdf.Page, rect: pymupdf.Rect, label: str, fill=SOFT) -> None:
    page.draw_rect(rect, color=INDIGO, fill=fill, width=1.5, radius=0.12)
    page.insert_textbox(
        rect + (8, rect.height / 2 - 10, -8, 0),
        label,
        fontsize=13,
        fontname="hebo",
        color=NAVY,
        align=pymupdf.TEXT_ALIGN_CENTER,
    )


def arrow(page: pymupdf.Page, a: pymupdf.Point, b: pymupdf.Point) -> None:
    page.draw_line(a, b, color=MUTED, width=1.5)
    page.draw_polyline([b + (-8, -5), b, b + (-8, 5)], color=MUTED, width=1.5)


def bar_chart(page, rect, labels, values, max_value, unit=""):
    n = len(values)
    gap = 18
    bw = (rect.width - gap * (n + 1)) / n
    page.draw_line(rect.bl, rect.br, color=MUTED, width=1)
    for i, (label, v) in enumerate(zip(labels, values, strict=True)):
        x0 = rect.x0 + gap + i * (bw + gap)
        bh = rect.height * v / max_value
        page.draw_rect(pymupdf.Rect(x0, rect.y1 - bh, x0 + bw, rect.y1), color=None, fill=INDIGO)
        page.insert_text((x0, rect.y1 - bh - 6), f"{v}{unit}", fontsize=11, color=INK)
        page.insert_text((x0, rect.y1 + 16), label, fontsize=11, color=MUTED)


def photo_placeholder(page: pymupdf.Page, rect: pymupdf.Rect) -> None:
    """Embed a real raster image so 'visual_count' is exercised."""
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 320, 180), False)
    for y in range(180):
        for x in range(0, 320, 4):
            shade = int(150 + 80 * (x / 320) * (1 - y / 360))
            pix.set_pixel(x, y, (shade, shade - 30, 210))
            pix.set_pixel(x + 1, y, (shade, shade - 30, 210))
            pix.set_pixel(x + 2, y, (shade, shade - 30, 210))
            pix.set_pixel(x + 3, y, (shade, shade - 30, 210))
    page.insert_image(rect, pixmap=pix)


# ---------------------------------------------------------------------------
# Decks
# ---------------------------------------------------------------------------
def fyp_deck() -> pymupdf.Document:
    """12-slide 16:9 FYP defence: titles, bullets, a diagram, a chart and an image."""
    doc = pymupdf.open()
    W, H = 960, 540
    foot = "PrepToPresent · Final Year Project"

    p = doc.new_page(width=W, height=H)
    p.draw_rect(p.rect, color=None, fill=NAVY)
    p.insert_textbox(
        pymupdf.Rect(60, 170, W - 60, 260),
        "PrepToPresent",
        fontsize=48,
        fontname="hebo",
        color=WHITE,
    )
    p.insert_textbox(
        pymupdf.Rect(60, 250, W - 60, 320),
        "An AI-Assisted Presentation Rehearsal and Feedback System",
        fontsize=22,
        color=(0.83, 0.85, 1),
    )
    p.insert_textbox(
        pymupdf.Rect(60, 400, W - 60, 460),
        "Final Year Project defence",
        fontsize=14,
        color=(0.68, 0.72, 1),
    )

    slides = [
        (
            "Problem statement",
            [
                "Public speaking anxiety hurts students' presentation performance",
                "Practising alone gives no objective feedback on pace, fillers or body language",
                "Self-assessment makes it hard to see improvement across practice sessions",
            ],
        ),
        (
            "Objectives",
            [
                "Build a web-based preparation and rehearsal system with AI support",
                "Provide automated speech and nonverbal feedback tied to exact moments",
                "Track performance and confidence across rehearsal sessions",
            ],
        ),
        (
            "Related work",
            [
                "Speech coaching apps focus on voice, rarely on rubric alignment",
                "Generic presentation tools give no structured rehearsal feedback",
                "Gap: preparation, rehearsal and progress tracking in one place",
            ],
        ),
        (
            "Methodology",
            [
                "Waterfall model: requirements, design, implementation, testing, deployment",
                "Feasibility checks for speech analysis and in-browser body tracking",
                "User study with 24 students for evaluation",
            ],
        ),
    ]
    n = 2
    for title, items in slides:
        page = new_slide(doc, W, H, title)
        bullets(page, items)
        footer(page, foot, n)
        n += 1

    # System architecture diagram
    page = new_slide(doc, W, H, "System architecture")
    boxes = [
        (pymupdf.Rect(60, 200, 250, 280), "Browser app"),
        (pymupdf.Rect(330, 200, 520, 280), "Web server"),
        (pymupdf.Rect(600, 140, 900, 220), "Database + storage"),
        (pymupdf.Rect(600, 260, 900, 340), "Analysis worker"),
    ]
    for r, label in boxes:
        box(page, r, label)
    arrow(page, pymupdf.Point(250, 240), pymupdf.Point(330, 240))
    arrow(page, pymupdf.Point(520, 225), pymupdf.Point(600, 185))
    arrow(page, pymupdf.Point(520, 255), pymupdf.Point(600, 300))
    page.insert_textbox(
        pymupdf.Rect(60, 380, W - 60, 440),
        "Body tracking runs in the browser; only numeric features are uploaded.",
        fontsize=15,
        color=MUTED,
    )
    footer(page, foot, n)
    n += 1

    page = new_slide(doc, W, H, "Implementation")
    bullets(
        page,
        [
            "Next.js web app with secure sign-in and row-level security",
            "Python worker for slide extraction, speech analysis and scoring",
            "Speech-to-text with word timestamps for filler and pace analysis",
        ],
        size=17,
    )
    photo_placeholder(page, pymupdf.Rect(560, 300, 900, 490))
    footer(page, foot, n)
    n += 1

    page = new_slide(doc, W, H, "Testing")
    bullets(
        page,
        [
            "Unit tests for scoring and extraction with fixed inputs",
            "End-to-end tests for sign-in, upload and rehearsal flows",
            "Accuracy checks against manually annotated recordings",
        ],
    )
    footer(page, foot, n)
    n += 1

    page = new_slide(doc, W, H, "Results")
    page.insert_text(
        (60, 130), "Average overall score by rehearsal (n = 24)", fontsize=15, color=MUTED
    )
    bar_chart(
        page,
        pymupdf.Rect(80, 160, 620, 450),
        ["Run 1", "Run 2", "Run 3", "Run 4"],
        [54, 63, 70, 78],
        100,
    )
    page.insert_textbox(
        pymupdf.Rect(660, 180, 900, 400),
        "Scores rose 24 points on average.\n\nSUS usability score: 78.",
        fontsize=16,
        color=INK,
    )
    footer(page, foot, n)
    n += 1

    for title, items in [
        (
            "Evaluation",
            [
                "Confidence check-ins rose from 2.8 to 3.9 out of 5",
                "Filler words fell by a third between the first and fourth run",
                "Interviews: feedback felt specific and encouraging",
            ],
        ),
        (
            "Limitations",
            [
                "Small sample of 24 students from one faculty",
                "Body-language accuracy depends on lighting and framing",
                "Solo presentations of up to 15 minutes only",
            ],
        ),
        (
            "Conclusion and future work",
            [
                "PrepToPresent supports preparation, rehearsal and progress tracking",
                "Future: larger study, more languages, live pace nudges",
                "Thank you. Questions?",
            ],
        ),
    ]:
        page = new_slide(doc, W, H, title)
        bullets(page, items)
        footer(page, foot, n)
        n += 1
    return doc


def class_deck_4x3() -> pymupdf.Document:
    """Short 4:3 class presentation, to check non-16:9 rendering."""
    doc = pymupdf.open()
    W, H = 720, 540
    content = [
        ("Introduction to Machine Learning", ["Class presentation", "Week 6 seminar"]),
        (
            "What is machine learning?",
            [
                "Programs that improve with data instead of fixed rules",
                "Used in search, translation and recommendations",
            ],
        ),
        (
            "Three types of learning",
            [
                "Supervised: learn from labelled examples",
                "Unsupervised: find structure in unlabelled data",
                "Reinforcement: learn by trial and reward",
            ],
        ),
        (
            "A simple example",
            [
                "Predict house prices from size and location",
                "Train on past sales, test on new ones",
            ],
        ),
        ("Risks", ["Biased training data gives biased results", "Models can be hard to explain"]),
        ("Summary", ["Machine learning learns patterns from data", "Questions?"]),
    ]
    for i, (title, items) in enumerate(content, start=1):
        page = new_slide(doc, W, H, title)
        bullets(page, items, top=140, size=20)
        footer(page, "Introduction to Machine Learning", i)
    return doc


def pitch_deck() -> pymupdf.Document:
    """3-slide pitch: minimal text, mostly visuals."""
    doc = pymupdf.open()
    W, H = 960, 540
    p = new_slide(doc, W, H, "StudySpot")
    p.insert_textbox(
        pymupdf.Rect(48, 110, W - 48, 160),
        "Find a quiet study space in seconds",
        fontsize=20,
        color=MUTED,
    )
    photo_placeholder(p, pymupdf.Rect(240, 180, 720, 450))
    p = new_slide(doc, W, H, "The problem")
    bar_chart(
        p, pymupdf.Rect(100, 140, 700, 460), ["Library", "Cafe", "Lab"], [35, 20, 15], 40, " min"
    )
    p.insert_textbox(
        pymupdf.Rect(720, 200, 920, 400),
        "Average time spent looking for a seat",
        fontsize=15,
        color=INK,
    )
    p = new_slide(doc, W, H, "Ask")
    bullets(p, ["Pilot with two faculties", "Feedback from 200 students"], size=22)
    return doc


def scanned(doc: pymupdf.Document) -> pymupdf.Document:
    """Image-only copy of a deck (no text layer), like a scanned handout."""
    out = pymupdf.open()
    for page in doc:
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5))
        new = out.new_page(width=page.rect.width, height=page.rect.height)
        new.insert_image(new.rect, pixmap=pix)
    return out


def too_long() -> pymupdf.Document:
    doc = pymupdf.open()
    for i in range(1, 62):
        page = new_slide(doc, 960, 540, f"Slide {i}")
        bullets(page, ["This deck has 61 slides, one more than the limit."])
    return doc


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fyp = fyp_deck()
    outputs = {
        "fyp-defence-12-slides.pdf": fyp,
        "class-presentation-4x3.pdf": class_deck_4x3(),
        "pitch-3-slides.pdf": pitch_deck(),
        "edge-scanned-no-text.pdf": scanned(fyp),
        "edge-61-slides-too-long.pdf": too_long(),
    }
    for name, doc in outputs.items():
        doc.save(OUT / name, garbage=3, deflate=True)
        print(f"wrote {name} ({doc.page_count} pages)")

    # Password-protected (user password "test")
    locked = class_deck_4x3()
    locked.save(
        OUT / "edge-password-protected.pdf",
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        user_pw="test",
        owner_pw="owner-test",
    )
    print("wrote edge-password-protected.pdf (password: test)")

    # Not actually a PDF
    (OUT / "edge-not-really-a-pdf.pdf").write_text("This is a text file with a .pdf name.\n")
    print("wrote edge-not-really-a-pdf.pdf")


if __name__ == "__main__":
    sys.exit(main())
