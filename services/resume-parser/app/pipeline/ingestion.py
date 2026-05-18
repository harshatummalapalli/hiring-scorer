"""Full ingestion orchestration."""

from __future__ import annotations

import logging
import time

from app.models.canonical import ParseRunResult, StructuredResume
from app.parsers.base import ParseInput
from app.parsers.docling_parser import DoclingParser

logger = logging.getLogger(__name__)

_parser = DoclingParser()


def run_ingestion(
    content: bytes,
    filename: str,
    *,
    content_type: str | None = None,
) -> ParseRunResult:
    started = time.perf_counter()
    warnings: list[str] = []
    try:
        data = ParseInput(
            content=content,
            filename=filename,
            mime_type=content_type,
        )
        structured = _parser.parse(data)
        warnings.extend(structured.metadata.extraction_warnings)
        duration_ms = int((time.perf_counter() - started) * 1000)
        success = bool(
            structured.raw_text.strip()
            or structured.experience
            or structured.skills
        )
        if not success:
            warnings.append("empty_extraction")
        return ParseRunResult(
            success=success,
            structured_resume=structured,
            warnings=warnings,
            duration_ms=duration_ms,
        )
    except Exception as exc:
        logger.exception("Ingestion failed for %s", filename)
        duration_ms = int((time.perf_counter() - started) * 1000)
        return ParseRunResult(
            success=False,
            error=str(exc),
            warnings=warnings + [f"ingestion_error:{type(exc).__name__}"],
            duration_ms=duration_ms,
        )


def ingest_from_text(text: str, filename: str = "resume.txt") -> ParseRunResult:
    return run_ingestion(text.encode("utf-8"), filename, content_type="text/plain")
