"""Skill normalization using aliases and fuzzy matching."""

from __future__ import annotations

from rapidfuzz import fuzz, process

SKILL_ALIASES: dict[str, str] = {
    "js": "JavaScript",
    "javascript": "JavaScript",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    "py": "Python",
    "python": "Python",
    "k8s": "Kubernetes",
    "kubernetes": "Kubernetes",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "node": "Node.js",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "react.js": "React",
    "reactjs": "React",
    "react": "React",
    "aws": "AWS",
    "gcp": "Google Cloud",
    "ml": "Machine Learning",
    "ai": "Artificial Intelligence",
    "llm": "Large Language Models",
    "llms": "Large Language Models",
    "fast api": "FastAPI",
    "fastapi": "FastAPI",
}

CANONICAL_SKILLS = sorted(set(SKILL_ALIASES.values()))


def normalize_skill(raw: str) -> tuple[str, float]:
    token = raw.strip()
    if not token:
        return raw, 0.0
    key = token.lower().replace(".", "")
    if key in SKILL_ALIASES:
        return SKILL_ALIASES[key], 0.98
    match = process.extractOne(
        token,
        CANONICAL_SKILLS,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=88,
    )
    if match:
        return match[0], match[1] / 100.0
    return token.title() if token.islower() else token, 0.75
