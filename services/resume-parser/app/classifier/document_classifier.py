"""Heuristic document classification before parser routing."""

from __future__ import annotations

import re
from pathlib import Path

from app.models.canonical import DocumentClassification

CANVA_MARKERS = ("canva", "designed with", "www.canva.com")
MULTI_COLUMN_HINTS = re.compile(
    r"(?m)^(?:.{1,35}\s{6,}.{1,35}|(?:\S+\s+){2,8}\S+\s{2,}(?:\S+\s+){2,8}\S+)$"
)


def classify_document(
    filename: str,
    raw_text: str,
    *,
    page_count: int = 1,
    image_ratio: float = 0.0,
) -> DocumentClassification:
    ext = Path(filename).suffix.lower()
    text = raw_text or ""
    lower_name = filename.lower()
    warnings_quality = 0.7

    if not text.strip():
        return DocumentClassification(
            document_type="malformed",
            layout_complexity="high",
            needs_ocr=True,
            parser_strategy="text_only",
            extraction_quality_estimate=0.1,
        )

    doc_type = "unknown"
    needs_ocr = False
    layout = "medium"

    if ext in (".txt", ".text"):
        doc_type = "txt"
        layout = "low"
    elif ext in (".docx", ".doc"):
        doc_type = "docx"
        layout = "low"
    elif ext == ".pdf":
        alpha = sum(1 for c in text if c.isalpha())
        ratio = alpha / max(len(text), 1)
        if ratio < 0.15 or len(text) < 80:
            doc_type = "scanned_pdf"
            needs_ocr = True
            layout = "high"
            warnings_quality = 0.35
        elif MULTI_COLUMN_HINTS.search(text[:4000]):
            doc_type = "multi_column"
            layout = "high"
            warnings_quality = 0.55
        else:
            doc_type = "text_pdf"
            layout = "medium" if len(text) > 8000 else "low"
    else:
        doc_type = "malformed"
        warnings_quality = 0.25

    if any(m in lower_name for m in CANVA_MARKERS) or any(
        m in text.lower()[:500] for m in CANVA_MARKERS
    ):
        doc_type = "canva_style"
        layout = "high"
        warnings_quality = min(warnings_quality, 0.5)

    if image_ratio > 0.4 or (page_count > 0 and len(text) / max(page_count, 1) < 120):
        doc_type = "image_heavy"
        needs_ocr = True
        layout = "high"
        warnings_quality = min(warnings_quality, 0.4)

    if text.count("|") > 25 or text.count("\t") > 40:
        doc_type = "table_heavy"
        layout = "high"
        warnings_quality = min(warnings_quality, 0.55)

    parser_strategy = "docling"
    if needs_ocr and doc_type == "scanned_pdf":
        parser_strategy = "fallback_structural"
    if doc_type in ("txt", "malformed"):
        parser_strategy = "text_only"

    return DocumentClassification(
        document_type=doc_type,
        layout_complexity=layout,
        needs_ocr=needs_ocr,
        parser_strategy=parser_strategy,
        extraction_quality_estimate=warnings_quality,
    )
