from django.db import models
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import FilterPaginationMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.hr.models import AssetPurchaseRequest
from apps.hr.filters import AssetPurchaseRequestFilter
from apps.hr.serializers.asset_purchase_request_serializers import AssetPurchaseRequestSerializer


class AssetPurchaseRequestView(CompanyBranchMixin, PermissionRequiredMixin, FilterPaginationMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'emp_asset'
    permission_classes = [IsAuthenticated]
    action_permission_any_of = {
        "": [("INVENTORY", "purchase_order")],
    }
    filterset_class = AssetPurchaseRequestFilter
    search_fields = ['asset__name', 'asset__serial_number']
    ordering_fields = ['created_at', 'under_date']
    ordering = ['-created_at']

    def get(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response({'error': 'User not associated with any company'}, status=400)

        requests = AssetPurchaseRequest.objects.filter(company_id=company_id, is_deleted=False)

        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            requests = requests.filter(models.Q(branch_id=request.user.branch_id) | models.Q(branch_id__isnull=True))

        requests = requests.select_related('asset', 'requested_by', 'purchase_order')
        requests = self.filter_queryset(requests)
        requests = self.search_queryset(requests)
        requests = self.order_queryset(requests)
        page = self.paginate_queryset(requests)
        serializer = AssetPurchaseRequestSerializer(page, many=True, context={'request': request})
        return self.get_paginated_response(serializer.data)

    def post(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        if not company_id:
            return Response({'error': 'User not associated with any company'}, status=400)

        serializer = AssetPurchaseRequestSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(
            company_id=company_id,
            branch_id=branch_id,
            requested_by=request.user,
            created_by=request.user,
            updated_by=request.user,
        )

        return Response({
            'message': 'Asset purchase request submitted',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def patch(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response({'error': 'User not associated with any company'}, status=400)

        request_uuid = request.data.get('id')
        if not request_uuid:
            return Response({'error': 'id (UUID) is required'}, status=400)

        obj = get_object_or_404(
            AssetPurchaseRequest,
            _id=request_uuid,
            company_id=company_id,
            is_deleted=False
        )

        update_data = {}
        if 'status' in request.data:
            update_data['status'] = request.data['status']
        if 'notes' in request.data:
            update_data['notes'] = request.data.get('notes')

        if update_data:
            update_data['updated_by'] = request.user
            for field, value in update_data.items():
                setattr(obj, field, value)
            obj.save(update_fields=list(update_data.keys()))

        serializer = AssetPurchaseRequestSerializer(obj, context={'request': request})
        return Response({
            'message': 'Request updated',
            'data': serializer.data
        })

    def delete(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response({'error': 'User not associated with any company'}, status=400)

        request_uuid = request.data.get('id')
        if not request_uuid:
            return Response({'error': 'id (UUID) is required'}, status=400)

        obj = get_object_or_404(
            AssetPurchaseRequest,
            _id=request_uuid,
            company_id=company_id,
            is_deleted=False
        )

        from django.utils import timezone
        obj.is_deleted = True
        obj.deleted_at = timezone.now()
        obj.deleted_by = request.user
        obj.save()

        return Response({'message': 'Request deleted'})
