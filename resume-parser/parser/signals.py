"""
Phase 5: Compute intelligence signals.
All deterministic. No AI.
"""

import re
from typing import List, Dict, Any
from datetime import datetime

OWNERSHIP_VERBS = re.compile(
    r"\b(?:built|designed|led|architected|created|"
    r"launched|established|drove|implemented|"
    r"developed|managed|owned|spearheaded|"
    r"delivered|optimized|scaled|migrated|"
    r"automated|reduced|increased|improved|"
    r"achieved|grew|transformed|deployed|"
    r"engineered|founded|directed|established)\b",
    re.IGNORECASE,
)

QUANTIFIED_PATTERN = re.compile(
    r"\d+\s*%|"
    r"\$\s*\d+|"
    r"\b\d+[kmb]\b|"
    r"\d+x\s+(?:faster|better|improvement)|"
    r"reduced\s+\w+\s+by\s+\d+|"
    r"increased\s+\w+\s+by\s+\d+|"
    r"\d+\s+(?:users|customers|clients|"
    r"engineers|employees|requests|transactions)",
    re.IGNORECASE,
)


def extract_bullets(text: str) -> List[str]:
    bullets = []
    for line in text.split("\n"):
        line = line.strip()
        if line.startswith(("•", "-", "*", "–", "·")):
            clean = line.lstrip("•-*–·").strip()
            if len(clean) > 10:
                bullets.append(clean)
        elif len(line) > 30 and OWNERSHIP_VERBS.search(line):
            bullets.append(line)
    return bullets


def compute_ownership_ratio(bullets: List[str]) -> dict:
    if not bullets:
        return {
            "ratio_percent": 0,
            "level": "Weak",
            "ownership_count": 0,
            "examples": [],
        }

    ownership = [b for b in bullets if OWNERSHIP_VERBS.search(b)]
    ratio = (len(ownership) / len(bullets)) * 100

    level = (
        "Strong" if ratio >= 60 else "Moderate" if ratio >= 30 else "Weak"
    )

    return {
        "ratio_percent": round(ratio),
        "level": level,
        "ownership_count": len(ownership),
        "examples": ownership[:3],
    }


def compute_quantification_ratio(bullets: List[str]) -> dict:
    if not bullets:
        return {
            "ratio_percent": 0,
            "level": "rarely",
            "examples": [],
        }

    quantified = [b for b in bullets if QUANTIFIED_PATTERN.search(b)]
    ratio = (len(quantified) / len(bullets)) * 100

    level = (
        "consistent" if ratio >= 50 else "sometimes" if ratio >= 20 else "rarely"
    )

    return {
        "ratio_percent": round(ratio),
        "level": level,
        "examples": quantified[:3],
    }


def detect_keyword_stuffing(text: str, skills: List[str]) -> bool:
    if len(skills) < 8:
        return False

    bullets_text = " ".join(extract_bullets(text))
    if not bullets_text:
        return False

    in_bullets = sum(
        1 for skill in skills if skill.lower() in bullets_text.lower()
    )

    ratio = in_bullets / len(skills)
    return ratio < 0.2


def compute_trajectory(experience: List[Dict[str, Any]]) -> str:
    if not experience:
        return "normal"

    total_months = 0
    role_count = len(experience)

    for entry in experience:
        start = entry.get("start_date")
        end = entry.get("end_date")
        if not start:
            continue
        try:
            from dateutil import parser as dp

            start_dt = dp.parse(start, default=datetime(2000, 1, 1))
            if not end or end.lower() in ("present", "current", "now"):
                end_dt = datetime.now()
            else:
                end_dt = dp.parse(end, default=datetime(2000, 1, 1))
            months = (end_dt.year - start_dt.year) * 12 + (
                end_dt.month - start_dt.month
            )
            total_months += max(0, months)
        except Exception:
            pass

    if role_count == 0:
        return "normal"

    avg_tenure = total_months / role_count

    if avg_tenure < 18:
        return "fast"
    elif avg_tenure > 48:
        return "slow"
    return "normal"
