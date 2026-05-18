"""Canonical resume schema — single source of truth for parsed resumes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

ExtractionMethod = Literal[
    "docling",
    "fallback_pdf",
    "fallback_docx",
    "fallback_text",
    "regex",
    "section_proximity",
    "ner",
    "semantic_match",
]

DocumentType = Literal[
    "text_pdf",
    "scanned_pdf",
    "docx",
    "txt",
    "multi_column",
    "image_heavy",
    "malformed",
    "table_heavy",
    "canva_style",
    "unknown",
]

ParserStrategy = Literal["docling", "fallback_structural", "text_only"]


class ConfidenceField(BaseModel):
    value: str
    confidence: float = Field(ge=0.0, le=1.0)
    extraction_method: ExtractionMethod = "regex"
    source_section: str | None = None


class DocumentClassification(BaseModel):
    document_type: DocumentType = "unknown"
    layout_complexity: Literal["low", "medium", "high"] = "medium"
    needs_ocr: bool = False
    parser_strategy: ParserStrategy = "docling"
    extraction_quality_estimate: float = Field(default=0.5, ge=0.0, le=1.0)


class ResumeBasics(BaseModel):
    full_name: ConfidenceField | None = None
    email: ConfidenceField | None = None
    phone: ConfidenceField | None = None
    linkedin: ConfidenceField | None = None
    github: ConfidenceField | None = None
    location: ConfidenceField | None = None
    summary: ConfidenceField | None = None


class ResumeExperience(BaseModel):
    company: ConfidenceField | None = None
    title: ConfidenceField | None = None
    start_date: str | None = None
    end_date: str | None = None
    duration_months: int | None = None
    bullets: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    evidence: list[str] = Field(default_factory=list)


class ResumeEducation(BaseModel):
    institution: str = ""
    degree: str | None = None
    field: str | None = None
    year: str | None = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class ResumeSkill(BaseModel):
    skill: str
    normalized_skill: str | None = None
    demonstrated: bool = False
    listed_only: bool = True
    evidence: str | None = None
    source_company: str | None = None
    source_section: str = "skills"
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class ResumeProject(BaseModel):
    name: str = ""
    description: str | None = None
    technologies: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class ResumeCertification(BaseModel):
    name: str = ""
    issuer: str | None = None
    year: str | None = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class TimelineMetrics(BaseModel):
    total_experience_months: int = 0
    total_experience_years: float = 0.0
    average_tenure_months: float = 0.0
    career_gaps_months: list[int] = Field(default_factory=list)
    growth_velocity: Literal["fast", "normal", "slow", "unknown"] = "unknown"
    career_stability: Literal["stable", "moderate", "volatile", "unknown"] = "unknown"
    current_role_title: str | None = None
    current_role_company: str | None = None


class ResumeMetadata(BaseModel):
    parser_used: str = "unknown"
    parse_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    document_type: DocumentType = "unknown"
    classification: DocumentClassification | None = None
    extraction_warnings: list[str] = Field(default_factory=list)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    raw_text_length: int = 0
    pii_stripped_text_length: int = 0


class StructuredResume(BaseModel):
    basics: ResumeBasics = Field(default_factory=ResumeBasics)
    experience: list[ResumeExperience] = Field(default_factory=list)
    education: list[ResumeEducation] = Field(default_factory=list)
    skills: list[ResumeSkill] = Field(default_factory=list)
    projects: list[ResumeProject] = Field(default_factory=list)
    certifications: list[ResumeCertification] = Field(default_factory=list)
    timeline: TimelineMetrics = Field(default_factory=TimelineMetrics)
    metadata: ResumeMetadata = Field(default_factory=ResumeMetadata)
    raw_text: str = ""
    pii_stripped_text: str = ""

    def model_dump_json_safe(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


class ParseRunResult(BaseModel):
    success: bool
    structured_resume: StructuredResume | None = None
    error: str | None = None
    warnings: list[str] = Field(default_factory=list)
    duration_ms: int = 0
