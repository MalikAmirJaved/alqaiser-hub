#!/bin/sh
set -e

echo "Waiting for DB..."
until pg_isready -h "${DB_HOST:-db}" -U "${DB_USER:-alqaiser_user}" -d "${DB_NAME:-alqaiser_hub}"; do
  sleep 2
done

echo "DB is ready."

# Collect static
echo "Collecting static files..."
python manage.py collectstatic --noinput 2>/dev/null || true

echo "Starting server..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application


#  for menually (without docker)
# source venv/bin/activate

#  deactivate teh source
# deactivate


# make migerations
# docker compose exec backend python manage.py makemigrations


# migerate to db
# docker compose exec backend python manage.py migrate


# initilize the Company
# docker compose exec backend python manage.py seed_org


# initilize the permissions
# docker compose exec backend python manage.py seed_permissions

# initilize the seed_chart_of_accounts
# docker compose exec backend python manage.py seed_chart_of_accounts --company-id=1 --branch-id=1

# for localy start backend server
# daphne -b 0.0.0.0 -p 8000 config.asgi:application

# create new module 
# python manage.py startapp 
