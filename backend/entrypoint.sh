#!/bin/sh
set -e

echo "Waiting for DB..."
until pg_isready -h "${DB_HOST:-db}" -U "${DB_USER:-alqaiser_user}" -d "${DB_NAME:-alqaiser_hub}"; do
  sleep 2
done
echo "DB is ready."

# Delete old migration files only
echo "Deleting old migration files..."
find . -path "*/migrations/*.py" ! -name "__init__.py" -delete
find . -path "*/migrations/*.pyc" -delete

# Create fresh migrations
echo "Creating migrations..."
python manage.py makemigrations organization --no-input
python manage.py makemigrations compsetting --no-input
python manage.py makemigrations hr --no-input
python manage.py makemigrations --no-input

# IMPORTANT:
# Fake initial because tables already exist
echo "Applying migrations..."
python manage.py migrate --fake-initial --no-input

# Collect static
python manage.py collectstatic --no-input --clear 2>/dev/null || true

# Seed
python manage.py seed_org || true

echo "Starting server..."
exec python manage.py runserver 0.0.0.0:8000