"""Test harness defaults — deterministic, no optional NLP model downloads."""

import os

os.environ.setdefault("KARTA_SKIP_PRESIDIO", "1")
os.environ.setdefault("ENABLE_DOCLING", "false")
