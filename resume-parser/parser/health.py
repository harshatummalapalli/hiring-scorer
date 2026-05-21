"""Health check and usage reporting."""

from datetime import datetime

startup_time = datetime.utcnow()


def get_health_status() -> dict:
    uptime_seconds = (datetime.utcnow() - startup_time).total_seconds()
    return {
        "status": "healthy",
        "uptime_seconds": round(uptime_seconds),
        "parser": "docling",
        "pii_engine": "spacy+regex",
        "model": "en_core_web_sm",
    }
