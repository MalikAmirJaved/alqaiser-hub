from django.apps import AppConfig
from apps.notifications.registry import register_websocket_model

class SalesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.sales'

    def ready(self):
        # Import models inside ready() to avoid circular imports
        from .models.lead import Lead
        from .models.quote import Quote

        # Register WebSocket models with appropriate entity names
        register_websocket_model(Lead, 'sales_lead')
        register_websocket_model(Quote, 'sales_quote')