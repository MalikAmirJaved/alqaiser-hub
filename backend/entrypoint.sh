#!/bin/sh
set -e

echo "Waiting for DB..."
until pg_isready -h "${DB_HOST:-db}" -U "${DB_USER:-alqaiser_user}" -d "${DB_NAME:-alqaiser_hub}"; do
  sleep 2
done

echo "DB is ready."

# Collect static
echo "Collecting static files..."
python manage.py collectstatic --no-input 2>/dev/null || true

# Seed data
echo "Running seed..."
python manage.py seed_org || echo "Seed skipped or failed"

echo "Starting server..."
exec python manage.py runserver 0.0.0.0:8000