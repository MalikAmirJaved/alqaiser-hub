from rest_framework.permissions import IsAuthenticated

class CompanyBranchMixin:
    """
    Mixin to filter queryset by user's company and branch based on role.
    Works with any ViewSet (ModelViewSet, GenericViewSet, etc.).
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if hasattr(user, 'role') and user.role == 'COMPANY_ADMIN':
            return qs.filter(company_id=user.company_id)
        return qs.filter(company_id=user.company_id, branch_id=user.branch_id)