"""Generate sample marking rubrics / assignment briefs for testing rubric parsing (F-14, F-15).

Usage (from services/worker):
    uv run python scripts/make_sample_rubrics.py        # writes to ../../samples/rubrics

Covers every input format (PDF, DOCX, photo, pasted text) and the messy cases the parser must
handle: points instead of percentages, weights that don't add up, prose briefs with no table,
and documents that aren't rubrics at all. All content is fictional.
"""

import io
from pathlib import Path

import pymupdf
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor
from PIL import Image, ImageEnhance, ImageFilter

OUT = Path(__file__).resolve().parents[3] / "samples" / "rubrics"

NAVY = (0x1E / 255, 0x2A / 255, 0x78 / 255)
INK = (0.08, 0.09, 0.11)
GRID = (0.55, 0.57, 0.62)
HEAD = (0.92, 0.93, 0.98)

LEVELS = ["Excellent (4)", "Good (3)", "Satisfactory (2)", "Poor (1)"]

# Criterion, weight %, descriptors for each level
FYP_RUBRIC = [
    (
        "Problem statement & objectives",
        20,
        [
            "Problem is clearly motivated with evidence; objectives are specific and measurable.",
            "Problem is clear; objectives are mostly specific.",
            "Problem is stated but weakly motivated; objectives are vague.",
            "Problem or objectives are missing or unclear.",
        ],
    ),
    (
        "Methodology",
        25,
        [
            "Method is well justified, appropriate and explained in enough detail to repeat.",
            "Method is appropriate with minor gaps in justification.",
            "Method is described but poorly justified.",
            "Method is unclear or inappropriate.",
        ],
    ),
    (
        "Results & evaluation",
        25,
        [
            "Results are presented clearly and critically evaluated against the objectives.",
            "Results are clear with some evaluation.",
            "Results are presented with little evaluation.",
            "Results are missing or not evaluated.",
        ],
    ),
    (
        "Presentation delivery",
        20,
        [
            "Confident, well paced, good eye contact; slides support the talk; within time.",
            "Generally confident and clear; minor timing or pacing issues.",
            "Reads from slides; noticeable pacing problems or over time.",
            "Hard to follow; significantly over or under time.",
        ],
    ),
    (
        "Q&A handling",
        10,
        [
            "Answers accurately and concisely, showing deep understanding.",
            "Answers most questions well.",
            "Answers some questions; struggles with follow-ups.",
            "Unable to answer most questions.",
        ],
    ),
]


# ---------------------------------------------------------------------------
# PDF helpers
# ---------------------------------------------------------------------------
def text_in(page: pymupdf.Page, rect: pymupdf.Rect, text: str, size=9.0, bold=False, color=INK):
    page.insert_textbox(
        rect + (4, 4, -4, -2), text, fontsize=size, fontname="hebo" if bold else "helv", color=color
    )


def rubric_table_pdf(
    title: str,
    subtitle: str,
    rows: list[tuple[str, int | str, list[str]]],
    weight_header: str = "Weight",
) -> pymupdf.Document:
    """Landscape A4 rubric: criterion | weight | 4 level columns."""
    doc = pymupdf.open()
    page = doc.new_page(width=842, height=595)
    page.insert_text((40, 50), title, fontsize=18, fontname="hebo", color=NAVY)
    page.insert_text((40, 70), subtitle, fontsize=10, color=GRID)

    cols = [150, 52] + [140] * 4
    x0, y = 40.0, 90.0
    header_h, row_h = 26.0, 72.0

    # header row
    x = x0
    for w, label in zip(cols, ["Criterion", weight_header, *LEVELS], strict=True):
        r = pymupdf.Rect(x, y, x + w, y + header_h)
        page.draw_rect(r, color=GRID, fill=HEAD, width=0.6)
        text_in(page, r, label, size=9.5, bold=True)
        x += w
    y += header_h

    for crit, weight, descriptors in rows:
        x = x0
        for i, (w, value) in enumerate(
            zip(cols, [crit, f"{weight}" if weight != "" else "", *descriptors], strict=True)
        ):
            r = pymupdf.Rect(x, y, x + w, y + row_h)
            page.draw_rect(r, color=GRID, width=0.6)
            text_in(page, r, value, size=9.5 if i < 2 else 8.5, bold=i == 0)
            x += w
        y += row_h
    return doc


# ---------------------------------------------------------------------------
# Samples
# ---------------------------------------------------------------------------
def fyp_pdf() -> pymupdf.Document:
    rows = [(c, f"{w}%", d) for c, w, d in FYP_RUBRIC]
    return rubric_table_pdf(
        "Final Year Project: Presentation Marking Rubric",
        "Assessment: FYP1 proposal defence · 15 minutes + 5 minutes Q&A · Total 100%",
        rows,
    )


def fyp_docx(path: Path) -> None:
    doc = Document()
    h = doc.add_heading("Final Year Project: Presentation Marking Rubric", level=1)
    h.alignment = WD_ALIGN_PARAGRAPH.LEFT
    doc.add_paragraph("Assessment: FYP1 proposal defence · 15 minutes + 5 minutes Q&A · Total 100%")
    table = doc.add_table(rows=1, cols=6)
    table.style = "Table Grid"
    for cell, label in zip(table.rows[0].cells, ["Criterion", "Weight", *LEVELS], strict=True):
        cell.text = label
        for run in cell.paragraphs[0].runs:
            run.bold = True
    for crit, weight, descriptors in FYP_RUBRIC:
        cells = table.add_row().cells
        for cell, value in zip(cells, [crit, f"{weight}%", *descriptors], strict=True):
            cell.text = value
            for run in cell.paragraphs[0].runs:
                run.font.size = Pt(9)
    doc.save(path)


def photo_of(pdf: pymupdf.Document) -> bytes:
    """Make a JPEG that looks like a phone photo of a printed page: rotated, warm, soft."""
    pix = pdf[0].get_pixmap(matrix=pymupdf.Matrix(1.6, 1.6))
    page_img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    canvas = Image.new("RGB", (page_img.width + 160, page_img.height + 160), (118, 104, 88))
    canvas.paste(page_img, (80, 80))
    img = canvas.rotate(-2.5, resample=Image.Resampling.BICUBIC, fillcolor=(118, 104, 88))
    img = ImageEnhance.Color(img).enhance(0.85)
    img = ImageEnhance.Brightness(img).enhance(0.93)
    warm = Image.new("RGB", img.size, (255, 236, 205))
    img = Image.blend(img, warm, 0.12).filter(ImageFilter.GaussianBlur(0.6))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=82)
    return out.getvalue()


def class_points_pdf() -> pymupdf.Document:
    """Uses points per criterion (total 50), not percentages."""
    rows = [
        (
            "Content accuracy",
            15,
            ["Accurate and complete", "Minor errors", "Several errors", "Major errors"],
        ),
        (
            "Organisation",
            10,
            ["Logical flow throughout", "Mostly logical", "Some jumps", "Disorganised"],
        ),
        (
            "Visual aids",
            10,
            ["Clear, readable, relevant", "Mostly clear", "Cluttered", "Distracting"],
        ),
        ("Delivery", 10, ["Engaging and confident", "Clear", "Hesitant", "Read from notes"]),
        (
            "Time management",
            5,
            ["Within 8 to 10 minutes", "Slightly off", "Over by 2+ min", "Far off"],
        ),
    ]
    return rubric_table_pdf(
        "Group Seminar Presentation Rubric (individual mark)",
        "Week 6 seminar · 8 to 10 minutes · Marked out of 50",
        rows,
        weight_header="Points",
    )


def weights_110_pdf() -> pymupdf.Document:
    """Weights add up to 110%: the review screen must flag it."""
    rows = [(c, f"{w + (10 if c == 'Methodology' else 0)}%", d) for c, w, d in FYP_RUBRIC]
    return rubric_table_pdf(
        "Presentation Rubric (draft)",
        "Note: draft version from the module page",
        rows,
    )


def pitch_brief_docx(path: Path) -> None:
    """A prose assignment brief: requirements but no rubric table and no weights."""
    doc = Document()
    doc.add_heading("Assignment 2: Startup Pitch", level=1)
    doc.add_paragraph(
        "You will deliver a 4-minute pitch for a product idea that solves a problem for "
        "university students. Pitches are followed by 2 minutes of questions from the panel."
    )
    doc.add_heading("Your pitch must", level=2)
    for item in [
        "Open with the problem and who experiences it, backed by at least one piece of evidence.",
        "Explain your solution and what makes it different from existing options.",
        "Describe who would pay for it and how.",
        "End with a clear ask (for example funding, a pilot partner or user testers).",
        "Stay within 4 minutes. Pitches over 4:30 lose marks.",
    ]:
        doc.add_paragraph(item, style="List Bullet")
    doc.add_heading("How it is marked", level=2)
    doc.add_paragraph(
        "The panel considers clarity of the problem, strength of the solution, the business "
        "model, delivery and how well you handle questions. Delivery and timing matter as much "
        "as the idea."
    )
    p = doc.add_paragraph("Submission: upload your slides as a PDF before the session.")
    p.runs[0].font.color.rgb = RGBColor(0x5A, 0x60, 0x6C)
    doc.save(path)


PASTED_TEXT = """Presentation assessment criteria (copied from the module guide)

1. Introduction and objectives - 15%
   Clear opening that states the aim of the talk and why it matters.
2. Background research - 20%
   Shows understanding of relevant literature and existing solutions.
3. Approach / design - 25%
   Explains the approach and justifies key decisions.
4. Findings - 20%
   Presents results clearly with appropriate visuals.
5. Delivery and timing - 20%
   Speaks clearly, maintains eye contact, finishes within the time limit.

Total: 100%
"""


def not_a_rubric_pdf() -> pymupdf.Document:
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(
        (60, 80), "FYP Supervision Meeting: Minutes", fontsize=18, fontname="hebo", color=NAVY
    )
    page.insert_textbox(
        pymupdf.Rect(60, 110, 535, 700),
        "Attendees: student, supervisor\n\n"
        "1. Progress update: the slide extraction feature is working.\n"
        "2. Supervisor suggested adding a sample rubric for testing.\n"
        "3. Next meeting in two weeks.\n\n"
        "Action items:\n- Prepare the proposal defence slides\n- Book a room for the rehearsal",
        fontsize=11,
        color=INK,
    )
    return doc


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    fyp = fyp_pdf()
    fyp.save(OUT / "fyp-presentation-rubric.pdf")
    print("wrote fyp-presentation-rubric.pdf")

    fyp_docx(OUT / "fyp-presentation-rubric.docx")
    print("wrote fyp-presentation-rubric.docx")

    (OUT / "fyp-presentation-rubric-photo.jpg").write_bytes(photo_of(fyp))
    print("wrote fyp-presentation-rubric-photo.jpg")

    class_points_pdf().save(OUT / "class-seminar-rubric-points.pdf")
    print("wrote class-seminar-rubric-points.pdf")

    pitch_brief_docx(OUT / "pitch-assignment-brief.docx")
    print("wrote pitch-assignment-brief.docx")

    (OUT / "rubric-pasted-text.txt").write_text(PASTED_TEXT, encoding="utf-8")
    print("wrote rubric-pasted-text.txt")

    weights_110_pdf().save(OUT / "edge-weights-sum-110.pdf")
    print("wrote edge-weights-sum-110.pdf")

    not_a_rubric_pdf().save(OUT / "edge-not-a-rubric.pdf")
    print("wrote edge-not-a-rubric.pdf")


if __name__ == "__main__":
    main()
