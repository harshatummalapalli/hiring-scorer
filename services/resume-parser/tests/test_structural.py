from app.classifier.document_classifier import classify_document
from app.pipeline.structural_builder import build_structured_from_text


SAMPLE_RESUME = """
Jane Doe
jane.doe@email.com | +1 555 123 4567
linkedin.com/in/janedoe

SUMMARY
Senior backend engineer with 8+ years building distributed systems.

EXPERIENCE
Senior Backend Engineer | Acme Corp
Jan 2020 - Present
• Built EKS deployment infrastructure using Kubernetes
• Led migration to PostgreSQL and Node.js services

Software Engineer | IBM India
Jun 2016 - Dec 2019
• Developed REST APIs in Python and JavaScript

SKILLS
Python, JavaScript, Kubernetes, PostgreSQL, AWS

EDUCATION
B.Tech Computer Science, MIT 2015
"""


def test_build_structured_resume():
    classification = classify_document("resume.txt", SAMPLE_RESUME)
    structured = build_structured_from_text(
        SAMPLE_RESUME,
        filename="resume.txt",
        parser_used="test",
        classification=classification,
        warnings=[],
    )
    assert structured.basics.email is not None
    assert structured.experience
    assert any(s.normalized_skill == "Kubernetes" for s in structured.skills)
    k8s = next(s for s in structured.skills if s.normalized_skill == "Kubernetes")
    assert k8s.demonstrated is True
    assert k8s.evidence is not None
    assert structured.timeline.total_experience_months > 0
    assert structured.pii_stripped_text
    assert "[REDACTED" in structured.pii_stripped_text or "@" not in structured.pii_stripped_text
