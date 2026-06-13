# apps/hr/apps.py
from django.apps import AppConfig

class HrConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.hr'
    verbose_name = 'HR Management'

    def ready(self):
        import apps.hr.signals