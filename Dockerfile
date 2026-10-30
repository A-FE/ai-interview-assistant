# Dockerfile for deploying to platforms that support Docker
# (Fly.io, Google Cloud Run, AWS App Runner, etc.)

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend ./backend

# Create directories for persistent data
RUN mkdir -p chroma_db

# Expose port (will be overridden by $PORT in most platforms)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Start command (use $PORT if available, otherwise 8000)
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
