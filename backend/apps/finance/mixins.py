from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status

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


class SoftDeleteMixin:
    """
    Override delete to perform soft delete instead of hard delete.
    Also filter out soft-deleted records in queryset.
    """

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter out soft-deleted records
        return queryset.filter(is_deleted=False)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save()
        return Response(
            {"success": True, "message": f"{instance.__class__.__name__} deleted successfully"},
            status=status.HTTP_200_OK
        )