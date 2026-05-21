"""
PII detection and stripping.
Uses spaCy NER for names and locations.
Uses regex + phonenumbers for contact details.
Zero external API calls. All local.
"""

import re
import spacy
import phonenumbers
from dataclasses import dataclass, field
from typing import Optional

# Load once at module level (not per request)
_nlp = None


def get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)

LINKEDIN_RE = re.compile(
    r"(?:https?://)?(?:www\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+/?",
    re.IGNORECASE,
)

GITHUB_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/[A-Za-z0-9\-_]+/?",
    re.IGNORECASE,
)

PORTFOLIO_RE = re.compile(
    r"https?://(?!linkedin|github)[A-Za-z0-9\-]+\.[A-Za-z]{2,}"
    r"(?:/[^\s]*)?",
    re.IGNORECASE,
)


@dataclass
class DetectedPii:
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    location: Optional[str] = None
    all_person_names: list = field(default_factory=list)


def detect_pii(text: str) -> DetectedPii:
    """
    Detect all PII in the full resume text.
    Scans the ENTIRE text — not just first lines.
    """
    result = DetectedPii()

    email_match = EMAIL_RE.search(text)
    if email_match:
        result.email = email_match.group(0).lower()

    linkedin_match = LINKEDIN_RE.search(text)
    if linkedin_match:
        url = linkedin_match.group(0)
        if not url.startswith("http"):
            url = "https://" + url
        result.linkedin_url = url

    github_match = GITHUB_RE.search(text)
    if github_match:
        url = github_match.group(0)
        if not url.startswith("http"):
            url = "https://" + url
        result.github_url = url

    for match in PORTFOLIO_RE.finditer(text):
        url = match.group(0)
        if result.linkedin_url and url in result.linkedin_url:
            continue
        if result.github_url and url in result.github_url:
            continue
        result.portfolio_url = url
        break

    try:
        for match in phonenumbers.PhoneNumberMatcher(text, "IN"):
            number = match.number
            if phonenumbers.is_valid_number(number):
                result.phone = phonenumbers.format_number(
                    number,
                    phonenumbers.PhoneNumberFormat.E164,
                )
                break
    except Exception:
        pass

    if not result.phone:
        try:
            for match in phonenumbers.PhoneNumberMatcher(text, "US"):
                number = match.number
                if phonenumbers.is_valid_number(number):
                    result.phone = phonenumbers.format_number(
                        number,
                        phonenumbers.PhoneNumberFormat.E164,
                    )
                    break
        except Exception:
            pass

    nlp = get_nlp()
    chunk_size = 100_000
    text_chunk = text[:chunk_size]

    doc = nlp(text_chunk)

    person_names = []
    locations = []

    for ent in doc.ents:
        if ent.label_ == "PERSON":
            name = ent.text.strip()
            words = name.split()
            if (
                2 <= len(words) <= 4
                and not any(c.isdigit() for c in name)
                and len(name) <= 50
            ):
                person_names.append(name)
        elif ent.label_ in ("GPE", "LOC"):
            locations.append(ent.text.strip())

    result.all_person_names = person_names

    first_30_lines = "\n".join(text.split("\n")[:30])
    doc_header = nlp(first_30_lines[:5000])
    for ent in doc_header.ents:
        if ent.label_ == "PERSON":
            name = ent.text.strip()
            words = name.split()
            if 2 <= len(words) <= 4 and not any(c.isdigit() for c in name):
                result.full_name = name
                break

    if not result.full_name and person_names:
        result.full_name = person_names[0]

    if locations:
        result.location = locations[0]

    return result


def strip_pii(text: str, pii: DetectedPii) -> str:
    """
    Replace detected PII in text with neutral placeholders.
    The stripped text is what gets stored and sent to AI.
    """
    stripped = text

    if pii.email:
        stripped = EMAIL_RE.sub("[EMAIL]", stripped)

    stripped = re.sub(
        r"\+?[\d\s\-().]{10,17}",
        lambda m: "[PHONE]"
        if len(re.sub(r"\D", "", m.group(0))) >= 10
        else m.group(0),
        stripped,
    )

    stripped = LINKEDIN_RE.sub("[LINKEDIN]", stripped)
    stripped = GITHUB_RE.sub("[GITHUB]", stripped)

    if pii.portfolio_url:
        stripped = stripped.replace(pii.portfolio_url, "[WEBSITE]")

    for name in pii.all_person_names:
        if len(name) >= 3:
            stripped = re.sub(
                re.escape(name),
                "[PERSON]",
                stripped,
                flags=re.IGNORECASE,
            )

    return stripped
