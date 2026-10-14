import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'generate-sales-forecast-daily': {
        'task': 'forecast.tasks.generate_sales_forecasts_for_all_companies',
        'schedule': crontab(hour=2, minute=0),
    },
    'generate-stock-forecast-daily': {
        'task': 'forecast.tasks.generate_stock_forecasts_for_all_companies',
        'schedule': crontab(hour=3, minute=0),
    },
}