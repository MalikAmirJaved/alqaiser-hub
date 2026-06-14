from rest_framework import viewsets, status
from rest_framework.response import Response
from django.db.models import Q
from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import Category
from apps.inventory.serializers import CategorySerializer


class CategoryViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()   # ADD THIS
    serializer_class = CategorySerializer

    def get_queryset(self):
        qs = super().get_queryset()

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(code__icontains=search)
            )

        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        serializer.save(
            company_id=request.user.company_id,
            branch_id=request.user.branch_id,
            created_by=request.user,
            updated_by=request.user,
        )

        return Response({
            'status': 'success',
            'message': f'Category "{serializer.instance.name}" has been created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=partial
        )

        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response({
            'status': 'success',
            'message': f'Category "{serializer.instance.name}" has been updated successfully.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        category_name = instance.name

        self.perform_destroy(instance)

        return Response({
            'status': 'success',
            'message': f'Category "{category_name}" has been deleted successfully.'
        }, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        serializer.save()