"""Build canonical StructuredResume from raw text."""

from __future__ import annotations

import re
from typing import Iterable

from app.models.canonical import (
    ConfidenceField,
    DocumentClassification,
    ResumeBasics,
    ResumeEducation,
    ResumeExperience,
    ResumeProject,
    ResumeSkill,
    StructuredResume,
)
from app.normalization.companies import normalize_company
from app.normalization.dates import extract_date_range
from app.normalization.skills import normalize_skill
from app.normalization.titles import normalize_title
from app.pipeline.timeline import compute_timeline
from app.pii.presidio_strip import strip_pii

SECTION_HEADERS = re.compile(
    r"^(?:professional\s+)?(?:summary|profile|objective|about(?:\s+me)?|"
    r"career\s+objective)\s*$|^(?:work\s+)?experience|employment|"
    r"professional\s+experience|career\s+history|education|academic|skills|"
    r"technical\s+skills|core\s+competencies$",
    re.I,
)

JOB_TITLE_HINT = re.compile(
    r"\b(?:engineer|developer|architect|manager|lead|analyst|consultant|"
    r"director|specialist|designer|scientist|administrator|coordinator|"
    r"associate|intern|tester|qa)\b",
    re.I,
)

EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", re.I
)
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,9}\b"
)
LINKEDIN_RE = re.compile(r"linkedin\.com/(?:in|pub)/[\w%-]+", re.I)
GITHUB_RE = re.compile(r"github\.com/[\w-]+", re.I)

SKILL_SPLIT = re.compile(r"[,;|•\n]|(?:\s{2,})")


def _cf(
    value: str,
    confidence: float,
    method: str = "regex",
    section: str | None = None,
) -> ConfidenceField:
    return ConfidenceField(
        value=value.strip(),
        confidence=confidence,
        extraction_method=method,  # type: ignore[arg-type]
        source_section=section,
    )


def split_sections(text: str) -> dict[str, list[str]]:
    lines = [ln.strip() for ln in text.splitlines()]
    sections: dict[str, list[str]] = {}
    current = "header"
    buffer: list[str] = []

    def flush() -> None:
        if buffer:
            sections[current] = list(buffer)
        buffer.clear()

    for line in lines:
        if not line:
            continue
        header_match = re.match(
            r"^(?:#{1,3}\s*)?([A-Z][A-Za-z\s/&-]{2,40}):?\s*$", line
        )
        cleaned = re.sub(r"[#*_]", "", line).strip()
        is_header = bool(SECTION_HEADERS.match(cleaned)) or (
            header_match
            and SECTION_HEADERS.match(header_match.group(1).strip())
            and len(line) < 50
        )
        if is_header:
            flush()
            key = cleaned.lower().replace("  ", " ")
            if re.search(r"summary|profile|objective|about", key):
                current = "summary"
            elif re.search(r"experience|employment|career", key):
                current = "experience"
            elif re.search(r"education|academic", key):
                current = "education"
            elif re.search(r"skill|competenc|technolog", key):
                current = "skills"
            else:
                current = key
            continue
        buffer.append(line)
    flush()
    return sections


def _extract_basics(text: str, sections: dict[str, list[str]]) -> ResumeBasics:
    lines = [ln for ln in text.splitlines() if ln.strip()][:8]
    name_line = lines[0] if lines else ""
    if name_line and (
        "@" in name_line
        or re.search(r"\d{3}", name_line)
        or len(name_line) > 60
    ):
        name_line = ""

    email_m = EMAIL_RE.search(text[:2000])
    phone_m = PHONE_RE.search(text[:2000])
    linkedin_m = LINKEDIN_RE.search(text)
    github_m = GITHUB_RE.search(text)

    summary_lines = sections.get("summary", [])
    summary = " ".join(summary_lines).strip()[:500] if summary_lines else ""

    basics = ResumeBasics()
    if name_line and re.match(r"^[A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+)+$", name_line):
        basics.full_name = _cf(name_line, 0.82, "section_proximity", "header")
    if email_m:
        basics.email = _cf(email_m.group(0), 0.95, "regex", "header")
    if phone_m:
        basics.phone = _cf(phone_m.group(0), 0.9, "regex", "header")
    if linkedin_m:
        basics.linkedin = _cf(
            f"https://{linkedin_m.group(0)}", 0.92, "regex", "header"
        )
    if github_m:
        basics.github = _cf(f"https://{github_m.group(0)}", 0.92, "regex", "header")
    if summary:
        basics.summary = _cf(summary, 0.78, "section_proximity", "summary")
    return basics


def _parse_experience_block(lines: list[str]) -> list[ResumeExperience]:
    entries: list[ResumeExperience] = []
    current: ResumeExperience | None = None
    bullets: list[str] = []

    def flush_role() -> None:
        nonlocal current, bullets
        if current:
            current.bullets = bullets[:12]
            entries.append(current)
        current = None
        bullets = []

    for line in lines:
        start_d, end_d = extract_date_range(line)
        if start_d or end_d:
            flush_role()
            title_part = DATE_RANGE_STRIP.sub("", line).strip(" -–—|,")
            company = ""
            title = title_part
            if " at " in title_part.lower():
                parts = re.split(r"\s+at\s+", title_part, maxsplit=1, flags=re.I)
                title, company = parts[0].strip(), parts[-1].strip()
            elif " | " in title_part:
                parts = [p.strip() for p in title_part.split("|", 1)]
                if len(parts) == 2:
                    title, company = parts[0], parts[1]
            norm_title, t_conf = normalize_title(title)
            norm_co, c_conf = normalize_company(company) if company else ("", 0.0)
            current = ResumeExperience(
                company=_cf(norm_co, c_conf, "regex", "experience")
                if norm_co
                else None,
                title=_cf(norm_title, t_conf, "section_proximity", "experience"),
                start_date=start_d,
                end_date=end_d,
                confidence=min(0.95, (t_conf + (c_conf or 0.7)) / 2),
                evidence=[line[:200]],
            )
            continue

        if line.startswith(("•", "-", "*", "·")) or re.match(r"^\d+\.\s", line):
            bullet = re.sub(r"^[\s•\-*\d.]+\s*", "", line).strip()
            if bullet:
                bullets.append(bullet)
            continue

        if JOB_TITLE_HINT.search(line) and len(line) < 120:
            flush_role()
            norm_title, t_conf = normalize_title(line)
            current = ResumeExperience(
                title=_cf(norm_title, t_conf, "section_proximity", "experience"),
                confidence=t_conf,
                evidence=[line[:200]],
            )
            continue

    flush_role()
    return entries


DATE_RANGE_STRIP = re.compile(
    r"(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}"
    r"|\b\d{1,2}/\d{4}|\b(?:19|20)\d{2})\s*(?:[-–—]|\s+to\s+)\s*"
    r"(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*(?:\d{4})?"
    r"|\b(?:Present|Current|Now)|\b\d{1,2}/\d{4}|\b(?:19|20)\d{2})",
    re.I,
)


def _parse_skills_section(lines: list[str]) -> list[str]:
    blob = " ".join(lines)
    tokens: list[str] = []
    for part in SKILL_SPLIT.split(blob):
        token = part.strip()
        if 2 <= len(token) <= 40 and not token.isdigit():
            tokens.append(token)
    return tokens[:80]


def _build_skill_records(
    listed: Iterable[str],
    experience: list[ResumeExperience],
) -> list[ResumeSkill]:
    work_blob = "\n".join(
        " ".join(e.bullets) for e in experience
    ).lower()
    records: list[ResumeSkill] = []
    seen: set[str] = set()

    for raw in listed:
        norm, conf = normalize_skill(raw)
        key = norm.lower()
        if key in seen:
            continue
        seen.add(key)
        demonstrated = key in work_blob or any(
            key in b.lower() for e in experience for b in e.bullets
        )
        evidence = None
        source_company = None
        for exp in experience:
            for bullet in exp.bullets:
                if key in bullet.lower():
                    evidence = bullet[:160]
                    source_company = (
                        exp.company.value if exp.company else None
                    )
                    break
            if evidence:
                break
        records.append(
            ResumeSkill(
                skill=raw.strip(),
                normalized_skill=norm,
                demonstrated=demonstrated,
                listed_only=not demonstrated,
                evidence=evidence,
                source_company=source_company,
                source_section="experience" if demonstrated else "skills",
                confidence=conf if demonstrated else conf * 0.85,
            )
        )
    return records


def _parse_education(lines: list[str]) -> list[ResumeEducation]:
    entries: list[ResumeEducation] = []
    for line in lines:
        if len(line) < 8:
            continue
        year_m = re.search(r"\b(19|20)\d{2}\b", line)
        entries.append(
            ResumeEducation(
                institution=line[:120],
                year=year_m.group(0) if year_m else None,
                confidence=0.7,
            )
        )
    return entries[:6]


def _overall_confidence(
    basics: ResumeBasics,
    experience: list[ResumeExperience],
    skills: list[ResumeSkill],
    classification: DocumentClassification,
) -> float:
    scores: list[float] = [classification.extraction_quality_estimate]
    if basics.full_name:
        scores.append(basics.full_name.confidence)
    if experience:
        scores.append(sum(e.confidence for e in experience) / len(experience))
    if skills:
        scores.append(sum(s.confidence for s in skills) / len(skills))
    return round(min(0.98, sum(scores) / max(len(scores), 1)), 3)


def build_structured_from_text(
    raw_text: str,
    *,
    filename: str,
    parser_used: str,
    classification: DocumentClassification,
    warnings: list[str],
) -> StructuredResume:
    sections = split_sections(raw_text)
    basics = _extract_basics(raw_text, sections)
    exp_lines = sections.get("experience", [])
    if not exp_lines and "header" in sections:
        exp_lines = sections.get("header", [])[20:]
    experience = _parse_experience_block(exp_lines)
    education = _parse_education(sections.get("education", []))
    listed_skills = _parse_skills_section(sections.get("skills", []))
    skills = _build_skill_records(listed_skills, experience)
    timeline = compute_timeline(experience)
    pii_stripped = strip_pii(raw_text)
    parse_confidence = _overall_confidence(
        basics, experience, skills, classification
    )

    if parse_confidence < 0.45:
        warnings.append("low_parse_confidence")

    return StructuredResume(
        basics=basics,
        experience=experience,
        education=education,
        skills=skills,
        projects=[],
        certifications=[],
        timeline=timeline,
        metadata={
            "parser_used": parser_used,
            "parse_confidence": parse_confidence,
            "document_type": classification.document_type,
            "classification": classification,
            "extraction_warnings": warnings,
            "raw_text_length": len(raw_text),
            "pii_stripped_text_length": len(pii_stripped),
        },
        raw_text=raw_text,
        pii_stripped_text=pii_stripped,
    )
