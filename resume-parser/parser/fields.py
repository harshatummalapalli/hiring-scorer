"""
Phase 4: Extract structured fields from the ORIGINAL
(pre-strip) resume text.
No AI. Pure Python + regex + heuristics.
"""

import re
from typing import Optional, List, Dict, Any
from datetime import datetime
from dateutil import parser as dateparser

SECTION_HEADERS = re.compile(
    r"^(?:work\s+)?experience|employment\s+history|"
    r"professional\s+experience|career\s+history|"
    r"education|academic|skills|technical\s+skills|"
    r"core\s+competencies|certifications|projects|"
    r"summary|profile|objective|about",
    re.IGNORECASE | re.MULTILINE,
)

DATE_RANGE_RE = re.compile(
    r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|"
    r"Nov|Dec)[a-z]*\.?\s*\d{4}|\d{4})"
    r"\s*[-–—]\s*"
    r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|"
    r"Nov|Dec)[a-z]*\.?\s*\d{4}|\d{4}|"
    r"Present|Current|Now)",
    re.IGNORECASE,
)

TITLE_KEYWORDS = re.compile(
    r"\b(?:engineer|developer|architect|manager|lead|"
    r"analyst|consultant|director|specialist|designer|"
    r"scientist|administrator|coordinator|associate|"
    r"intern|tester|qa|senior|sr\.?|junior|jr\.?|"
    r"staff|principal|head|vp|vice\s+president|"
    r"product|data|ml|ai|software|devops|sre|"
    r"full[- ]?stack|backend|frontend|cloud|"
    r"platform|site\s+reliability|security|"
    r"recruiter|talent\s+acquisition)\b",
    re.IGNORECASE,
)

COMPANY_SUFFIXES = re.compile(
    r"\b(?:inc\.?|ltd\.?|llc\.?|corp\.?|"
    r"limited|pvt\.?|private|technologies|"
    r"solutions|systems|services|software|"
    r"consulting|group|global|india|labs?)\b",
    re.IGNORECASE,
)

SKILLS_SECTION_RE = re.compile(
    r"(?:technical\s+)?skills|technologies|"
    r"core\s+competencies|tools|frameworks|"
    r"programming\s+languages",
    re.IGNORECASE,
)


def split_into_sections(text: str) -> Dict[str, str]:
    lines = text.split("\n")
    sections: Dict[str, List[str]] = {"header": []}
    current = "header"

    for line in lines:
        stripped = line.strip()
        if not stripped:
            sections.setdefault(current, []).append("")
            continue

        if (
            len(stripped) < 50
            and SECTION_HEADERS.search(stripped)
            and not stripped.endswith((".", ",", ";"))
        ):
            current = stripped.lower().strip(":").strip()
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, []).append(stripped)

    return {k: "\n".join(v) for k, v in sections.items()}


def extract_current_title_company(text: str) -> tuple[Optional[str], Optional[str]]:
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    title = None
    company = None

    for i, line in enumerate(lines[:40]):
        if TITLE_KEYWORDS.search(line):
            if len(line) < 80 and "|" in line:
                parts = [p.strip() for p in line.split("|")]
                for part in parts:
                    if TITLE_KEYWORDS.search(part) and not title:
                        title = part
                    elif COMPANY_SUFFIXES.search(part) or (
                        len(part) > 2 and not TITLE_KEYWORDS.search(part)
                    ):
                        company = part
            elif len(line) < 80:
                title = line
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    if (
                        len(next_line) < 60
                        and not TITLE_KEYWORDS.search(next_line)
                        and not DATE_RANGE_RE.search(next_line)
                    ):
                        company = next_line
            break

    return title, company


def extract_skills(text: str) -> List[str]:
    sections = split_into_sections(text)

    skills_text = ""
    for key, content in sections.items():
        if SKILLS_SECTION_RE.search(key):
            skills_text = content
            break

    if not skills_text:
        skills_text = text

    raw = re.split(r"[,•·|\n/]+", skills_text)
    skills = []
    seen = set()

    for item in raw:
        item = item.strip().strip("*-–").strip()
        if (
            1 <= len(item.split()) <= 5
            and len(item) > 1
            and len(item) < 40
            and not item.endswith(".")
        ):
            key = item.lower()
            if key not in seen:
                seen.add(key)
                skills.append(item)

    return skills[:20]


def parse_experience_entries(text: str) -> List[Dict[str, Any]]:
    sections = split_into_sections(text)
    exp_text = ""
    for key, content in sections.items():
        if re.search(r"experience|employment|career|work", key, re.IGNORECASE):
            exp_text = content
            break

    if not exp_text:
        exp_text = text

    entries = []
    lines = exp_text.split("\n")

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if DATE_RANGE_RE.search(line):
            date_match = DATE_RANGE_RE.search(line)
            start_date = date_match.group(1) if date_match else None
            end_date = date_match.group(2) if date_match else None

            title = None
            company = None

            if i > 0:
                prev = lines[i - 1].strip()
                if TITLE_KEYWORDS.search(prev) and len(prev) < 80:
                    title = prev

            if not title and TITLE_KEYWORDS.search(line):
                clean = DATE_RANGE_RE.sub("", line).strip()
                if TITLE_KEYWORDS.search(clean):
                    title = clean

            for j in range(i + 1, min(i + 4, len(lines))):
                candidate = lines[j].strip()
                if (
                    candidate
                    and not DATE_RANGE_RE.search(candidate)
                    and not TITLE_KEYWORDS.search(candidate)
                    and len(candidate) < 60
                ):
                    company = candidate
                    break

            bullets = []
            for j in range(i + 1, len(lines)):
                bl = lines[j].strip()
                if DATE_RANGE_RE.search(bl):
                    break
                if bl.startswith(("•", "-", "*", "–")) or (
                    len(bl) > 20
                    and re.search(
                        r"\b(?:led|built|designed|"
                        r"managed|created|developed|"
                        r"implemented|reduced|increased|"
                        r"improved)\b",
                        bl,
                        re.IGNORECASE,
                    )
                ):
                    clean_bullet = bl.lstrip("•-*–·").strip()
                    if clean_bullet:
                        bullets.append(clean_bullet)
                if len(bullets) >= 5:
                    break

            if title or company:
                entries.append(
                    {
                        "title": title or "Role",
                        "company": company or "Company",
                        "start_date": start_date,
                        "end_date": end_date,
                        "bullets": bullets,
                        "technologies": [],
                    }
                )

        i += 1

    return entries[:8]


def parse_education_entries(text: str) -> List[Dict[str, Any]]:
    sections = split_into_sections(text)
    edu_text = ""
    for key, content in sections.items():
        if re.search(r"education|academic|qualification", key, re.IGNORECASE):
            edu_text = content
            break

    if not edu_text:
        return []

    entries = []
    lines = [l.strip() for l in edu_text.split("\n") if l.strip()]

    degree_re = re.compile(
        r"\b(?:B\.?Tech|B\.?E\.?|M\.?Tech|M\.?E\.?|"
        r"MBA|MCA|BCA|B\.?Sc\.?|M\.?Sc\.?|"
        r"Ph\.?D\.?|PGDM|PGD|B\.?A\.?|M\.?A\.?|"
        r"Bachelor|Master|Doctorate|Associate|"
        r"Diploma|Certificate)\b",
        re.IGNORECASE,
    )

    year_re = re.compile(r"\b(20\d{2}|19\d{2})\b")

    for i, line in enumerate(lines):
        if degree_re.search(line):
            degree_match = degree_re.search(line)
            degree = degree_match.group(0) if degree_match else None
            year_match = year_re.search(line)
            year = year_match.group(0) if year_match else None

            institution = None
            for j in [i + 1, i - 1, i + 2]:
                if 0 <= j < len(lines):
                    candidate = lines[j]
                    if (
                        not degree_re.search(candidate)
                        and len(candidate) > 4
                        and len(candidate) < 80
                    ):
                        institution = candidate
                        break

            if degree or institution:
                entries.append(
                    {
                        "institution": institution or "Institution",
                        "degree": degree,
                        "field": None,
                        "year": year,
                        "confidence": 0.8,
                    }
                )

    return entries[:5]


def calculate_total_experience(
    experience: List[Dict[str, Any]],
    text: str,
) -> Optional[str]:
    explicit = re.search(
        r"(\d+)\+?\s*years?\s+(?:of\s+)?experience",
        text,
        re.IGNORECASE,
    )
    if explicit:
        return f"{explicit.group(1)} years"

    if not experience:
        return None

    total_months = 0
    for entry in experience:
        start = entry.get("start_date")
        end = entry.get("end_date")
        if not start:
            continue
        try:
            start_dt = dateparser.parse(start, default=datetime(2000, 1, 1))
            if not end or end.lower() in ("present", "current", "now"):
                end_dt = datetime.now()
            else:
                end_dt = dateparser.parse(end, default=datetime(2000, 1, 1))
            months = (end_dt.year - start_dt.year) * 12 + (
                end_dt.month - start_dt.month
            )
            total_months += max(0, months)
        except Exception:
            pass

    if total_months > 0:
        years = total_months // 12
        return f"{years} years"

    return None
