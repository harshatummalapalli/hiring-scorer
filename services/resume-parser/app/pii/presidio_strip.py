"""PII stripping — Presidio when available, regex fallback."""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@"
    r"[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b",
    re.I,
)
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,9}\b"
)
URL_RE = re.compile(r"https?://[^\s<>\"')\]]+|www\.[^\s<>\"')\]]+", re.I)

REDACT_EMAIL = "[REDACTED EMAIL]"
REDACT_PHONE = "[REDACTED PHONE]"
REDACT_URL = "[REDACTED URL]"

_analyzer = None
_anonymizer = None


def _init_presidio():
    global _analyzer, _anonymizer
    if _analyzer is not None:
        return True
    try:
        from presidio_analyzer import AnalyzerEngine
        from presidio_anonymizer import AnonymizerEngine

        _analyzer = AnalyzerEngine()
        _anonymizer = AnonymizerEngine()
        return True
    except Exception as exc:
        logger.info("Presidio unavailable, using regex PII strip: %s", exc)
        return False


def strip_pii(text: str) -> str:
    if not text.strip():
        return text
    if _init_presidio():
        try:
            from presidio_anonymizer.entities import OperatorConfig

            results = _analyzer.analyze(text=text, language="en")
            return _anonymizer.anonymize(
                text=text,
                analyzer_results=results,
                operators={
                    "DEFAULT": OperatorConfig("replace", {"new_value": "[REDACTED]"}),
                    "EMAIL_ADDRESS": OperatorConfig(
                        "replace", {"new_value": REDACT_EMAIL}
                    ),
                    "PHONE_NUMBER": OperatorConfig(
                        "replace", {"new_value": REDACT_PHONE}
                    ),
                    "URL": OperatorConfig("replace", {"new_value": REDACT_URL}),
                },
            ).text
        except Exception as exc:
            logger.warning("Presidio strip failed: %s", exc)
    return _regex_strip(text)


def _regex_strip(text: str) -> str:
    out = EMAIL_RE.sub(REDACT_EMAIL, text)
    out = PHONE_RE.sub(REDACT_PHONE, out)
    out = URL_RE.sub(REDACT_URL, out)
    return out
