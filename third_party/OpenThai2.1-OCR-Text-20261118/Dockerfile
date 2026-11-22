# OpenThai 2.1 OCR Container for Google Cloud Run / Container Platforms
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OPENTHAI_HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

# Install minimal system libraries for OpenCV and ONNX / OpenVINO
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model files, runtime, and server script
COPY . .

# Expose container port (Cloud Run defaults to 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Start the OCR HTTP Server
CMD ["python", "server.py"]
