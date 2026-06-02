from rest_framework import viewsets

class CompanyBranchUserMixin:
    """
    Automatically set company_id, branch_id, created_by, updated_by
    from request.user on create/update.
    """

    def perform_create(self, serializer):
        serializer.save(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(
            updated_by=self.request.user,
        )