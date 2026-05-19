FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Optional models — service runs with fallbacks if missing
RUN python -m spacy download en_core_web_sm || true

COPY app ./app

ENV ENABLE_DOCLING=true
ENV KARTA_SKIP_PRESIDIO=0
ENV LOG_LEVEL=INFO

EXPOSE 8090

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
