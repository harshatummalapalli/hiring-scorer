"""Normalize resume dates to ISO-like strings."""

from __future__ import annotations

import re
from datetime import datetime

from dateutil import parser as date_parser

MONTH_PATTERN = re.compile(
    r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\.?\s*(\d{4})?\b",
    re.I,
)

DATE_RANGE = re.compile(
    r"(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}"
    r"|\b\d{1,2}/\d{4}|\b(?:19|20)\d{2})\s*(?:[-–—]|\s+to\s+)\s*"
    r"(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*(?:\d{4})?"
    r"|\b(?:Present|Current|Now)|\b\d{1,2}/\d{4}|\b(?:19|20)\d{2})",
    re.I,
)

PRESENT = re.compile(r"\b(present|current|now)\b", re.I)


def parse_date_token(token: str) -> str | None:
    t = token.strip()
    if not t:
        return None
    if PRESENT.search(t):
        return "present"
    if re.fullmatch(r"(?:19|20)\d{2}", t):
        return t
    try:
        dt = date_parser.parse(t, default=datetime(2000, 1, 1))
        return dt.strftime("%Y-%m")
    except (ValueError, OverflowError):
        year = re.search(r"\b(19|20)\d{2}\b", t)
        if year:
            return f"{year.group(0)}"
    return None


def extract_date_range(line: str) -> tuple[str | None, str | None]:
    m = DATE_RANGE.search(line)
    if not m:
        return None, None
    return parse_date_token(m.group(1)), parse_date_token(m.group(2))
