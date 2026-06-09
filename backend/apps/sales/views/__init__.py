from .lead import LeadViewSet
from .quote import QuoteViewSet
from .invoice import SalesInvoiceViewSet
from .dashboard import SalesDashboardViewSet

__all__ = [
    'LeadViewSet',
    'QuoteViewSet',
    'SalesInvoiceViewSet',
    'SalesDashboardViewSet',
]
