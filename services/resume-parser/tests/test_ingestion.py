from app.pipeline.ingestion import ingest_from_text

SAMPLE = """
Alex Smith
alex@example.com

EXPERIENCE
Engineer at StartupCo
2021 - Present
• Worked with React and TypeScript

SKILLS
React, TypeScript
"""


def test_ingest_from_text():
    result = ingest_from_text(SAMPLE, "test.txt")
    assert result.success is True
    assert result.structured_resume is not None
    assert result.structured_resume.metadata.parse_confidence > 0
    assert result.duration_ms >= 0
