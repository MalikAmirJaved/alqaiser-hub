from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from apps.inventory.models import Supplier
from apps.inventory.serializers import SupplierSerializer

class BaseSupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Supplier.objects.filter(
            company_id=user.company_id,
            branch_id=user.branch_id,
            partner_type=self.partner_type
        )
        # Search
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(code__icontains=search) | Q(email__icontains=search)
            )
        # Status filter
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        # Sorting
        sort_by = self.request.query_params.get('sort_by')
        sort_order = self.request.query_params.get('sort_order', 'asc')
        if sort_by:
            order = '' if sort_order == 'asc' else '-'
            qs = qs.order_by(f'{order}{sort_by}')
        return qs

    def perform_create(self, serializer):
        serializer.save(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id,
            partner_type=self.partner_type
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'status': 'success',
            'message': f'{self.partner_type.title()} "{serializer.instance.name}" created.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'status': 'success',
            'message': f'{self.partner_type.title()} "{serializer.instance.name}" updated.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name
        self.perform_destroy(instance)
        return Response({
            'status': 'success',
            'message': f'{self.partner_type.title()} "{name}" deleted.'
        })

class SupplierViewSet(BaseSupplierViewSet):
    partner_type = 'supplier'

class VendorViewSet(BaseSupplierViewSet):
    partner_type = 'vendor'