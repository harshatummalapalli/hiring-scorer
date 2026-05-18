"""Parser abstraction layer."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.models.canonical import StructuredResume


@dataclass
class ParseInput:
    filename: str
    content: bytes
    mime_type: str | None = None


class ResumeParser(ABC):
    name: str = "base"

    @abstractmethod
    def parse(self, data: ParseInput) -> StructuredResume:
        """Parse file bytes into canonical structured resume."""
