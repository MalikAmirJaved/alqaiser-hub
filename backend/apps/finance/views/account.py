from rest_framework import viewsets
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import Account
from apps.finance.serializers import AccountSerializer
from apps.finance.mixins import CompanyBranchUserMixin

class AccountViewSet(CompanyBranchUserMixin,CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_module = 'FINANCE'
    permission_resource = 'account'