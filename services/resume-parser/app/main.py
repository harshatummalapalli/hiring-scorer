"""Karta local resume parsing service."""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.canonical import ParseRunResult
from app.pipeline.ingestion import ingest_from_text, run_ingestion

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(settings.app_name)

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_start_time = time.time()
_metrics: dict[str, int] = {
    "parse_requests": 0,
    "parse_success": 0,
    "parse_failures": 0,
}


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "uptime_seconds": int(time.time() - _start_time),
        "docling_enabled": settings.enable_docling,
        "metrics": _metrics,
    }


@app.get("/diagnostics")
def diagnostics() -> dict[str, Any]:
    spacy_ok = False
    presidio_ok = False
    try:
        import spacy  # noqa: F401

        spacy_ok = True
    except ImportError:
        pass
    try:
        from presidio_analyzer import AnalyzerEngine  # noqa: F401

        presidio_ok = True
    except ImportError:
        pass
    return {
        "spacy_available": spacy_ok,
        "presidio_available": presidio_ok,
        "spacy_model": settings.spacy_model,
        "sentence_transformer": settings.sentence_transformer_model,
    }


@app.post("/parse", response_model=ParseRunResult)
async def parse_resume(file: UploadFile = File(...)) -> ParseRunResult:
    _metrics["parse_requests"] += 1
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File too large")
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    filename = file.filename or "resume.pdf"
    result = run_ingestion(content, filename, content_type=file.content_type)
    if result.success:
        _metrics["parse_success"] += 1
    else:
        _metrics["parse_failures"] += 1
    return result


@app.post("/parse-text", response_model=ParseRunResult)
async def parse_text(payload: dict[str, str]) -> ParseRunResult:
    _metrics["parse_requests"] += 1
    text = (payload.get("text") or "").strip()
    filename = payload.get("filename") or "resume.txt"
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")
    result = ingest_from_text(text, filename)
    if result.success:
        _metrics["parse_success"] += 1
    else:
        _metrics["parse_failures"] += 1
    return result
