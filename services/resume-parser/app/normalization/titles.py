"""Job title normalization."""

from __future__ import annotations

from rapidfuzz import fuzz, process

TITLE_EQUIVALENTS: dict[str, str] = {
    "sde": "Software Engineer",
    "sde i": "Software Engineer I",
    "sde ii": "Software Engineer II",
    "sde 1": "Software Engineer I",
    "sde 2": "Software Engineer II",
    "swe": "Software Engineer",
    "swe ii": "Software Engineer II",
    "swe 2": "Software Engineer II",
    "sr sde": "Senior Software Engineer",
    "senior sde": "Senior Software Engineer",
    "software dev": "Software Developer",
    "software developer": "Software Developer",
    "backend dev": "Backend Engineer",
    "backend developer": "Backend Engineer",
    "full stack": "Full Stack Engineer",
    "fullstack": "Full Stack Engineer",
    "full-stack": "Full Stack Engineer",
}

CANONICAL_TITLES = sorted(set(TITLE_EQUIVALENTS.values()))


def normalize_title(raw: str) -> tuple[str, float]:
    t = " ".join(raw.split()).strip()
    if not t:
        return raw, 0.0
    key = t.lower()
    if key in TITLE_EQUIVALENTS:
        return TITLE_EQUIVALENTS[key], 0.95
    match = process.extractOne(
        t,
        CANONICAL_TITLES,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=90,
    )
    if match:
        return match[0], match[1] / 100.0
    return t, 0.8
