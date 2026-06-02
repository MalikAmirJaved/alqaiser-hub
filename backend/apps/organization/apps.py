from django.apps import AppConfig
from apps.notifications.registry import register_websocket_model

class OrganizationConfig(AppConfig):
    name = 'apps.organization'

    def ready(self):
        # Import models inside ready() to avoid AppRegistryNotReady
        from .models import Company, Branch, User
        register_websocket_model(Company, 'company')
        register_websocket_model(Branch, 'branch')
        register_websocket_model(User, 'user')