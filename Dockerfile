# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory inside container
WORKDIR /app

# Prevent Python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY models/ ./models/
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Default port for Cloud Run (overridden by $PORT if set)
ENV PORT=8080
EXPOSE 8080

# Command to run application via Uvicorn
CMD exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080}
