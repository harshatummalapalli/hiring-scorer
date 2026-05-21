"""
Karta Resume Parser Service
FastAPI application for Google Cloud Run.

Privacy contract:
- Receives raw resume bytes
- Detects PII across entire text
- Returns PII as structured fields
- Returns pii_stripped_text with PII replaced
- Never logs PII
- Never stores anything
- Stateless: every request is independent
"""

import re
import time
import os
import sys
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from parser.extractor import extract_text_from_bytes
from parser.pii import detect_pii, strip_pii
from parser.fields import (
    extract_current_title_company,
    extract_skills,
    parse_experience_entries,
    parse_education_entries,
    calculate_total_experience,
)
from parser.signals import (
    extract_bullets,
    compute_ownership_ratio,
    compute_quantification_ratio,
    detect_keyword_stuffing,
    compute_trajectory,
)
from parser.health import get_health_status

app = FastAPI(
    title="Karta Resume Parser",
    description="Privacy-safe resume parsing service",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)

ALLOWED_ORIGINS = [
    os.getenv("KARTA_ORIGIN", "https://hiring-scorer.vercel.app"),
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

PARSER_SECRET = os.getenv("PARSER_SECRET_KEY", "")


def verify_secret(request: Request) -> None:
    if not PARSER_SECRET:
        return
    secret = request.headers.get("X-Parser-Secret", "")
    if secret != PARSER_SECRET:
        raise HTTPException(status_code=401, detail="Invalid parser secret key")


def confidence_field(value, conf=0.85):
    if not value:
        return None
    return {
        "value": value,
        "confidence": conf,
        "extraction_method": "nlp",
    }


def build_parse_response(
    raw_text: str,
    parser_used: str,
    start_ms: float,
    warnings: list,
) -> dict:
    pii = detect_pii(raw_text)
    pii_stripped = strip_pii(raw_text, pii)

    title, company = extract_current_title_company(raw_text)
    skills = extract_skills(raw_text)
    experience = parse_experience_entries(raw_text)
    education = parse_education_entries(raw_text)
    calculate_total_experience(experience, raw_text)

    bullets = extract_bullets(pii_stripped)
    ownership = compute_ownership_ratio(bullets)
    compute_quantification_ratio(bullets)
    detect_keyword_stuffing(pii_stripped, skills)
    trajectory = compute_trajectory(experience)

    structured_resume = {
        "basics": {
            "full_name": confidence_field(pii.full_name, 0.90),
            "email": confidence_field(pii.email, 0.99),
            "phone": confidence_field(pii.phone, 0.95),
            "linkedin": confidence_field(pii.linkedin_url, 0.99),
            "github": confidence_field(pii.github_url, 0.99),
            "location": confidence_field(pii.location, 0.75),
            "summary": None,
        },
        "experience": [
            {
                "company": confidence_field(e["company"]),
                "title": confidence_field(e["title"]),
                "start_date": e["start_date"],
                "end_date": e["end_date"],
                "duration_months": None,
                "bullets": e["bullets"],
                "technologies": [],
                "confidence": 0.80,
                "evidence": [],
            }
            for e in experience
        ],
        "education": [
            {
                "institution": e["institution"],
                "degree": e.get("degree"),
                "field": e.get("field"),
                "year": e.get("year"),
                "confidence": e.get("confidence", 0.80),
            }
            for e in education
        ],
        "skills": [
            {
                "skill": s,
                "normalized_skill": s.lower(),
                "demonstrated": True,
                "listed_only": False,
                "evidence": None,
                "source_section": "skills",
                "confidence": 0.70,
            }
            for s in skills
        ],
        "projects": [],
        "certifications": [],
        "timeline": {
            "total_experience_months": 0,
            "total_experience_years": 0,
            "average_tenure_months": 0,
            "career_gaps_months": [],
            "growth_velocity": trajectory,
            "career_stability": "stable",
            "current_role_title": title,
            "current_role_company": company,
        },
        "metadata": {
            "parser_used": parser_used,
            "parse_confidence": 0.80,
            "document_type": "resume",
            "classification": None,
            "extraction_warnings": warnings,
            "created_at": datetime.utcnow().isoformat(),
            "raw_text_length": len(raw_text),
            "pii_stripped_text_length": len(pii_stripped),
        },
        "raw_text": raw_text,
        "pii_stripped_text": pii_stripped,
    }

    _ = ownership

    duration = time.time() * 1000 - start_ms

    return {
        "success": True,
        "structured_resume": structured_resume,
        "warnings": warnings,
        "duration_ms": round(duration),
    }


@app.get("/health")
def health():
    return get_health_status()


@app.post("/parse")
async def parse_resume(
    request: Request,
    file: UploadFile = File(...),
):
    verify_secret(request)
    start_ms = time.time() * 1000
    warnings = []

    try:
        file_bytes = await file.read()
        filename = file.filename or "resume"
        mime_type = file.content_type or ""

        raw_text, parser_used = extract_text_from_bytes(
            file_bytes, filename, mime_type
        )

        if not raw_text or len(raw_text.strip()) < 50:
            return {
                "success": False,
                "error": "Could not extract text from resume",
                "warnings": ["extraction_failed"],
                "duration_ms": round(time.time() * 1000 - start_ms),
            }

        raw_text = re.sub(r"\r\n", "\n", raw_text)
        raw_text = re.sub(r"\r", "\n", raw_text)
        raw_text = re.sub(r"\n{3,}", "\n\n", raw_text)
        raw_text = raw_text.strip()

        return build_parse_response(raw_text, parser_used, start_ms, warnings)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[parser] Error: {e}", file=sys.stderr)
        return {
            "success": False,
            "error": str(e),
            "warnings": ["unexpected_error"],
            "duration_ms": round(time.time() * 1000 - start_ms),
        }


class ParseTextBody(BaseModel):
    text: str
    filename: str = "resume.txt"


@app.post("/parse-text")
async def parse_resume_text(request: Request, body: ParseTextBody):
    verify_secret(request)
    start_ms = time.time() * 1000
    warnings = []

    raw_text = body.text.strip()
    if not raw_text:
        return {
            "success": False,
            "error": "No text provided",
            "warnings": ["no_text"],
            "duration_ms": 0,
        }

    try:
        raw_text = re.sub(r"\r\n", "\n", raw_text)
        raw_text = re.sub(r"\r", "\n", raw_text)
        raw_text = re.sub(r"\n{3,}", "\n\n", raw_text)
        raw_text = raw_text.strip()

        return build_parse_response(
            raw_text, "plain-text", start_ms, warnings
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[parser] Error: {e}", file=sys.stderr)
        return {
            "success": False,
            "error": str(e),
            "warnings": ["unexpected_error"],
            "duration_ms": round(time.time() * 1000 - start_ms),
        }
