"""Fallback local text extraction without Docling."""

from __future__ import annotations

import io
import re
from pathlib import Path

from app.parsers.base import ParseInput


def extract_raw_text(data: ParseInput) -> tuple[str, int, float]:
    """Return raw_text, page_count, image_ratio_estimate."""
    ext = Path(data.filename).suffix.lower()
    if ext in (".txt", ".text"):
        text = data.content.decode("utf-8", errors="replace")
        return _normalize_text(text), 1, 0.0

    if ext in (".docx", ".doc"):
        try:
            import docx

            doc = docx.Document(io.BytesIO(data.content))
            parts = [p.text for p in doc.paragraphs if p.text.strip()]
            return _normalize_text("\n".join(parts)), 1, 0.0
        except Exception:
            return "", 1, 0.0

    if ext == ".pdf":
        try:
            import fitz

            doc = fitz.open(stream=data.content, filetype="pdf")
            parts: list[str] = []
            images = 0
            blocks = 0
            for page in doc:
                parts.append(page.get_text("text"))
                blocks += 1
                images += len(page.get_images())
            text = _normalize_text("\n".join(parts))
            image_ratio = images / max(blocks, 1) / 10.0
            return text, len(doc), min(image_ratio, 1.0)
        except Exception:
            return "", 1, 0.0

    return "", 0, 0.0


def _normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip()[:50_000]
