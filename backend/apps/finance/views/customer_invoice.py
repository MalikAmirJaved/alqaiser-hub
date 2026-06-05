from rest_framework import viewsets
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import CustomerInvoice
from apps.finance.serializers import CustomerInvoiceSerializer
from apps.finance.mixins import CompanyBranchUserMixin


class CustomerInvoiceViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    viewsets.ReadOnlyModelViewSet
):
    queryset = CustomerInvoice.objects.all()
    serializer_class = CustomerInvoiceSerializer
    permission_module = 'FINANCE'
    permission_resource = 'customerinvoice'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'