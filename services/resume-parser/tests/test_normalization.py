from app.normalization.companies import normalize_company
from app.normalization.dates import extract_date_range, parse_date_token
from app.normalization.skills import normalize_skill
from app.normalization.titles import normalize_title


def test_normalize_skill_aliases():
    name, conf = normalize_skill("k8s")
    assert name == "Kubernetes"
    assert conf >= 0.9


def test_normalize_title_sde():
    title, conf = normalize_title("SDE II")
    assert "Software Engineer" in title
    assert conf >= 0.9


def test_normalize_company_ibm():
    company, conf = normalize_company("IBM India Pvt Ltd")
    assert company == "IBM"
    assert conf >= 0.85


def test_date_range():
    start, end = extract_date_range("Software Engineer  Jan 2020 - Present")
    assert start is not None
    assert end == "present"


def test_parse_year_only():
    assert parse_date_token("2019") == "2019"
