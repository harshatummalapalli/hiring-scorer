FROM python:3.11-slim

WORKDIR /app

# System dependencies for Docling
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model (en_core_web_sm — lightweight,
# sufficient for NER-based PII detection)
RUN python -m spacy download en_core_web_sm

# Pre-warm Docling model weights at build time
# so container startup is fast (not on first request)
RUN python -c "from docling.document_converter import \
DocumentConverter; DocumentConverter()"

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", \
     "--port", "8080", "--workers", "1"]
