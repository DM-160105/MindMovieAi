FROM python:3.10-slim

EXPOSE 7860
WORKDIR /app

# System deps for faiss-cpu build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps (layer cached — only invalidates when requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Writable dirs for HF Spaces (runs as non-root user 1000)
RUN mkdir -p /tmp/hf_cache /app/artifacts && \
    chown -R 1000:1000 /app /tmp/hf_cache

USER 1000

ENV HF_HOME=/tmp/hf_cache
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "7860"]
