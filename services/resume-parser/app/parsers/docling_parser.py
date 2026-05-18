"""Docling-first parser with local fallbacks."""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from app.classifier.document_classifier import classify_document
from app.config import settings
from app.models.canonical import StructuredResume
from app.parsers.base import ParseInput, ResumeParser
from app.parsers.text_extract import extract_raw_text
from app.pipeline.structural_builder import build_structured_from_text

logger = logging.getLogger(__name__)


class DoclingParser(ResumeParser):
    name = "docling"

    def parse(self, data: ParseInput) -> StructuredResume:
        warnings: list[str] = []
        parser_used = "fallback_structural"
        raw_text = ""
        page_count = 1
        image_ratio = 0.0

        if settings.enable_docling:
            docling_text, docling_warnings = _try_docling(data)
            if docling_text.strip():
                raw_text = docling_text
                parser_used = "docling"
                warnings.extend(docling_warnings)
            else:
                warnings.append("Docling extraction empty; using fallback extractor.")

        if not raw_text.strip():
            raw_text, page_count, image_ratio = extract_raw_text(data)
            parser_used = "fallback_structural"
            if not raw_text.strip():
                warnings.append("No text could be extracted from document.")
                classification = classify_document(data.filename, "", page_count=0)
                return StructuredResume(
                    metadata={
                        "parser_used": parser_used,
                        "parse_confidence": 0.05,
                        "document_type": classification.document_type,
                        "classification": classification,
                        "extraction_warnings": warnings + ["empty_document"],
                        "raw_text_length": 0,
                    },
                    raw_text="",
                    pii_stripped_text="",
                )

        classification = classify_document(
            data.filename, raw_text, page_count=page_count, image_ratio=image_ratio
        )
        structured = build_structured_from_text(
            raw_text,
            filename=data.filename,
            parser_used=parser_used,
            classification=classification,
            warnings=warnings,
        )
        return structured


def _try_docling(data: ParseInput) -> tuple[str, list[str]]:
    warnings: list[str] = []
    try:
        from docling.document_converter import DocumentConverter
    except ImportError:
        return "", ["docling_not_installed"]

    ext = Path(data.filename).suffix.lower() or ".pdf"
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(data.content)
            tmp_path = tmp.name
        converter = DocumentConverter()
        result = converter.convert(tmp_path)
        text = result.document.export_to_markdown() if result.document else ""
        Path(tmp_path).unlink(missing_ok=True)
        return text.strip(), warnings
    except Exception as exc:
        logger.warning("Docling parse failed: %s", exc)
        warnings.append(f"docling_error:{type(exc).__name__}")
        return "", warnings
