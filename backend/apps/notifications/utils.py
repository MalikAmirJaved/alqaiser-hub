# apps/notifications/utils.py
import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db import transaction

logger = logging.getLogger(__name__)

def broadcast_data_update(company_id, branch_id, entity, action=None, record_id=None):
    """
    Send a WebSocket 'data_update' message to the company/branch group.
    - company_id, branch_id: can be None or integer.
    - entity: string identifier used by frontend (e.g., 'employee', 'product').
    - action: 'create', 'update', 'delete' (optional)
    - record_id: integer PK or UUID (will be stringified)
    """
    if company_id is None:
        logger.warning(f"broadcast_data_update called without company_id for entity {entity}")
        return

    channel_layer = get_channel_layer()
    group_name = f"notify_c{company_id}_b{branch_id}" if branch_id else f"notify_c{company_id}_bNone"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'data_update',
            'entity': entity,
            'action': action,
            'record_id': str(record_id) if record_id else None,
        }
    )


# Helper to safely get company/branch from any instance
def get_company_branch(instance):
    """Extract company_id and branch_id from a model instance using common field names."""
    company_id = getattr(instance, 'company_id', None)
    branch_id = getattr(instance, 'branch_id', None)

    meta = getattr(instance, '_meta', None)

    # If the instance itself is a Company, its own id IS the company_id
    if company_id is None and meta and meta.model_name == 'company' and hasattr(instance, 'id'):
        company_id = instance.id

    # If the instance itself is a Branch, its own id IS the branch_id
    if branch_id is None and meta and meta.model_name == 'branch' and hasattr(instance, 'id'):
        branch_id = instance.id

    # Fallback for models that have a FK to Company/Branch but not direct ID fields
    if company_id is None and hasattr(instance, 'company'):
        company_id = getattr(instance.company, 'id', None)
    if branch_id is None and hasattr(instance, 'branch'):
        branch_id = getattr(instance.branch, 'id', None)

    return company_id, branch_id