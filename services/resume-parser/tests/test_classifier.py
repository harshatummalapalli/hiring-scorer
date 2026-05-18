from app.classifier.document_classifier import classify_document


def test_classify_txt():
    c = classify_document("resume.txt", "Hello world\nExperience\nAcme Corp")
    assert c.document_type == "txt"
    assert c.needs_ocr is False


def test_classify_scanned_pdf():
    c = classify_document("resume.pdf", "!!!", page_count=2)
    assert c.document_type in ("scanned_pdf", "malformed", "image_heavy")
    assert c.needs_ocr is True


def test_classify_multi_column_hint():
    text = "Left column text here          Right column more text\n" * 5
    c = classify_document("resume.pdf", text + "x" * 200, page_count=1)
    assert c.document_type in ("multi_column", "text_pdf", "unknown")
