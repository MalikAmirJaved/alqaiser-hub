# Development stage
FROM python:3.12-slim AS development

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Production stage
FROM development AS production

RUN pip install gunicorn==21.2.0

# Run as non-root user
RUN adduser --disabled-password --gecos '' django-user
USER django-user

EXPOSE 8000