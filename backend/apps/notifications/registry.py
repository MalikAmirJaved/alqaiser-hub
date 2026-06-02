# apps/notifications/registry.py
from django.db.models.base import ModelBase
from .utils import broadcast_data_update, get_company_branch

# Registry: {ModelClass: entity_name}
_registry = {}

def register_websocket_model(model, entity_name):
    """
    Register a Django model to automatically broadcast changes via WebSocket.
    Usage: register_websocket_model(Employee, 'employees')
    """
    if not isinstance(model, ModelBase):
        raise TypeError("model must be a Django Model class")
    _registry[model] = entity_name

def get_registered_models():
    return _registry.copy()