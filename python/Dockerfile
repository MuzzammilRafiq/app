# Python 3.13 with uv for dependency management
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for the app
# - build-essential: for compiling Python packages
# - poppler-utils: for pdf2image
# - libheif: for HEIF image support
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    poppler-utils \
    libheif-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files first for better caching
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
RUN uv sync --frozen --no-dev

# Copy application code
COPY . .

# Expose the default uvicorn port
EXPOSE 8000

# Run the FastAPI server
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
