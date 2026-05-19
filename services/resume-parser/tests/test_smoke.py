"""Fast import and pipeline smoke checks."""


def test_import_app_modules() -> None:
    from app.classifier.document_classifier import classify_document
    from app.normalization.companies import normalize_company
    from app.normalization.dates import parse_date_token
    from app.pipeline.structural_builder import build_structured_from_text

    assert classify_document("x.txt", "hello").document_type == "txt"
    assert normalize_company("IBM India Pvt Ltd")[0] == "IBM"
    assert parse_date_token("2019") == "2019"


def test_build_minimal_resume() -> None:
    from app.classifier.document_classifier import classify_document
    from app.pipeline.structural_builder import build_structured_from_text

    text = "EXPERIENCE\nEngineer | Acme\n2020 - 2021\n• Built APIs in Python\n"
    classification = classify_document("r.txt", text)
    structured = build_structured_from_text(
        text,
        filename="r.txt",
        parser_used="test",
        classification=classification,
        warnings=[],
    )
    assert structured.experience
    assert structured.skills or structured.experience[0].bullets
