from rest_framework.permissions import IsAuthenticated
import logging
logger = logging.getLogger(__name__)

class CompanyBranchMixin:
    """
    Filters queryset by:
    - company (always required)
    - branch (optional based on role)
    - soft delete support (if model has is_deleted)
    """

    permission_classes = [IsAuthenticated]

    # optional toggle per ViewSet
    branch_filter_enabled = True

    def get_queryset(self):

        user = self.request.user
        qs = super().get_queryset()

        # 1. Always enforce company isolation
        if not hasattr(user, "company_id"):
            return qs.none()

        qs = qs.filter(company_id=user.company_id)

        # 2. Soft delete safety (only if field exists)
        if hasattr(qs.model, "is_deleted"):
            qs = qs.filter(is_deleted=False)

        # 3. Branch isolation (role-based)
        role = getattr(user, "role", None)
        if self.branch_filter_enabled and role != "COMPANY_ADMIN":
            # ensure branch exists before filtering
            if getattr(user, "branch_id", None):
                qs = qs.filter(branch_id=user.branch_id)
            else:
                # user has no branch → no data access
                return qs.none()

        return qs