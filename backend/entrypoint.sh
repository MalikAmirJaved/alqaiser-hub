#!/bin/sh
set -e

echo "Waiting for DB..."
until pg_isready -h "${DB_HOST:-db}" -U "${DB_USER:-alqaiser_user}" -d "${DB_NAME:-alqaiser_hub}"; do
  sleep 2
done
echo "DB is ready."

# Step 1: Make migrations for apps that have models (safe to run repeatedly)
python manage.py makemigrations organization --no-input
python manage.py makemigrations compsetting --no-input
python manage.py makemigrations --no-input

# Step 2: Apply all migrations in dependency order
python manage.py migrate organization --no-input
python manage.py migrate compsetting --no-input
python manage.py migrate --no-input

# Step 3: Collect static files (needed even in dev for admin)
python manage.py collectstatic --no-input --clear 2>/dev/null || true

# Step 4: Seed initial data
echo "Seeding data..."
python manage.py seed_org

# Step 5: Start server
echo "Starting server..."
exec python manage.py runserver 0.0.0.0:8000