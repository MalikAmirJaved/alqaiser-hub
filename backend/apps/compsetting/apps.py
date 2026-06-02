from django.apps import AppConfig
from apps.notifications.registry import register_websocket_model

class CompsettingConfig(AppConfig):
    name = 'apps.compsetting'
    label = 'compsetting'
    verbose_name = 'Company Settings'

    def ready(self):
        from .models import CompanySettings, Designation
        register_websocket_model(CompanySettings, 'company_settings')
        register_websocket_model(Designation, 'designation')