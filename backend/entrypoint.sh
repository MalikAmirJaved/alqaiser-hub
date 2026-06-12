#!/bin/sh
set -e

echo "Waiting for DB..."
until pg_isready -h "${DB_HOST:-db}" -U "${DB_USER:-alqaiser_user}" -d "${DB_NAME:-alqaiser_hub}"; do
  sleep 2
done
echo "DB is ready."

# IMPORTANT: DO NOT delete migration files - they are needed for Django to work
# Only delete __pycache__ files if needed
echo "Cleaning pycache files..."
find . -path "*/__pycache__/*" -delete 2>/dev/null || true

# Create new migrations ONLY IF models changed
echo "Creating migrations..."
python manage.py makemigrations --no-input

# Apply migrations (DO NOT USE --fake-initial unless you know what you're doing)
echo "Applying migrations..."
python manage.py migrate --no-input

# Collect static
python manage.py collectstatic --no-input --clear 2>/dev/null || true

# Seed (first time only - should check if already seeded)
python manage.py seed_org || true

echo "Starting server..."
exec python manage.py runserver 0.0.0.0:8000