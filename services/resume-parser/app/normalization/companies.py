"""Company name normalization."""

from __future__ import annotations

import re

COMPANY_SUFFIXES = re.compile(
    r"\b(?:inc|inc\.|corp|corporation|ltd|limited|llc|plc|gmbh|pvt|private)\.?\s*$",
    re.I,
)

COMPANY_ALIASES: dict[str, str] = {
    "ibm india": "IBM",
    "ibm corp": "IBM",
    "ibm corporation": "IBM",
    "international business machines": "IBM",
    "amazon web services": "AWS",
    "google india": "Google",
    "microsoft corporation": "Microsoft",
    "meta platforms": "Meta",
    "facebook": "Meta",
}


def normalize_company(raw: str) -> tuple[str, float]:
    c = " ".join(raw.split()).strip()
    if not c:
        return raw, 0.0
    key = c.lower()
    if key in COMPANY_ALIASES:
        return COMPANY_ALIASES[key], 0.95
    cleaned = COMPANY_SUFFIXES.sub("", c).strip()
    cleaned = cleaned.rstrip(",").strip()
    if cleaned.lower() in COMPANY_ALIASES:
        return COMPANY_ALIASES[cleaned.lower()], 0.9
    return cleaned, 0.85
