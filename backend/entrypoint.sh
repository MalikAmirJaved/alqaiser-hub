#!/bin/sh

echo "Waiting for DB..."

until pg_isready -h db -U alqaiser_user -d alqaiser_hub; do
  sleep 2
done

echo "Running makemigrations..."
python manage.py makemigrations

echo "Running migrations..."
python manage.py migrate

echo "Seeding data..."
python manage.py seed_org

echo "Starting server..."
exec python manage.py runserver 0.0.0.0:8000