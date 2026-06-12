# apps/hr/views/asset_views.py
from datetime import datetime, date
from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.hr.models import Asset
from apps.hr.serializers.asset_serializers import AssetSerializer

logger = logging.getLogger(__name__)


class AssetView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'emp_asset'
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all assets for user's company"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = Asset.objects.filter(company_id=company_id, is_deleted=False)
        
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            query = query.filter(models.Q(branch_id=branch_id) | models.Q(branch_id__isnull=True))
        
        vendor = request.query_params.get('vendor')
        is_assigned = request.query_params.get('is_assigned')
        category = request.query_params.get('category')
        search = request.query_params.get('search')
        
        if vendor:
            query = query.filter(vendor__iexact=vendor)
        if is_assigned is not None:
            query = query.filter(is_assigned=is_assigned.lower() == 'true')
        if category:
            query = query.filter(category__iexact=category)
        if search:
            query = query.filter(
                models.Q(name__icontains=search) |
                models.Q(brand__icontains=search) |
                models.Q(model__icontains=search) |
                models.Q(serial_number__icontains=search) |
                models.Q(vendor__icontains=search) |
                models.Q(category__icontains=search)
            )
        
        assets = query.order_by('-created_at')
        serializer = AssetSerializer(assets, many=True)
        return Response(serializer.data)
    

    def post(self, request):
        """Create new asset (simplified)"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Only validate required fields: name
        if not request.data.get('name'):
            return Response(
                {'error': 'Asset name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Optional: check serial number uniqueness if provided
        serial_number = request.data.get('serialNumber') or request.data.get('serial_number')
        if serial_number:
            if Asset.objects.filter(serial_number=serial_number, is_deleted=False).exists():
                return Response(
                    {'error': 'Asset with this serial number already exists'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Prepare data for serializer
        data = {
            'name': request.data['name'],
            'brand': request.data.get('brand'),
            'model': request.data.get('model'),
            'serial_number': serial_number,
            'description': request.data.get('description'),
            'category': request.data.get('category'),
            'total_quantity': int(request.data.get('totalQuantity', request.data.get('total_quantity', 1))),
            'is_active': request.data.get('isActive', True),
            # Purchase fields are optional; if not provided, they become null
            'purchase_date': request.data.get('purchaseDate') or None,
            'purchase_price': request.data.get('purchasePrice') or None,
            'warranty_until': request.data.get('warrantyUntil') or None,
            'vendor': request.data.get('vendor'),
        }
        
        # Ensure available_quantity equals total_quantity (serializer will handle)
        data['available_quantity'] = data['total_quantity']
        
        serializer = AssetSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        asset = serializer.save(
            company_id=company_id,
            branch_id=branch_id,
            created_by=request.user,
            updated_by=request.user,
        )
        
        return Response({
            "message": "Asset created successfully",
            "data": AssetSerializer(asset).data
        }, status=status.HTTP_201_CREATED)
    

    def patch(self, request):
        """Update asset using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        asset_uuid = request.data.get('id')
        if not asset_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        asset = get_object_or_404(
            Asset,
            _id=asset_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        # Build update data
        update_data = {}
        if 'name' in request.data:
            update_data['name'] = request.data['name']
        if 'brand' in request.data:
            update_data['brand'] = request.data.get('brand')
        if 'model' in request.data:
            update_data['model'] = request.data.get('model')
        if 'serialNumber' in request.data:
            new_serial = request.data['serialNumber']
            if new_serial and new_serial != asset.serial_number:
                if Asset.objects.filter(serial_number=new_serial, is_deleted=False).exclude(_id=asset_uuid).exists():
                    return Response(
                        {'error': 'Asset with this serial number already exists'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            update_data['serial_number'] = new_serial or None
        if 'description' in request.data:
            update_data['description'] = request.data.get('description')
        if 'category' in request.data:
            update_data['category'] = request.data.get('category')
        if 'totalQuantity' in request.data:
            update_data['total_quantity'] = int(request.data['totalQuantity'])
        if 'availableQuantity' in request.data:
            update_data['available_quantity'] = int(request.data['availableQuantity'])
        if 'isActive' in request.data:
            update_data['is_active'] = request.data['isActive']
        if 'purchaseDate' in request.data:
            update_data['purchase_date'] = request.data.get('purchaseDate') or None
        if 'purchasePrice' in request.data:
            update_data['purchase_price'] = request.data.get('purchasePrice') or None
        if 'warrantyUntil' in request.data:
            update_data['warranty_until'] = request.data.get('warrantyUntil') or None
        if 'vendor' in request.data:
            update_data['vendor'] = request.data.get('vendor')
        
        serializer = AssetSerializer(asset, data=update_data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        
        return Response({
            "message": "Asset updated successfully",
            "data": serializer.data
        })
    

    def delete(self, request):
        """Soft delete asset using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        asset_uuid = request.data.get('id')
        if not asset_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        asset = get_object_or_404(
            Asset,
            _id=asset_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        if asset.is_assigned:
            return Response(
                {'error': 'Cannot delete asset that is currently assigned to an employee'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        asset.is_deleted = True
        asset.deleted_at = timezone.now()
        asset.deleted_by = request.user
        asset.save()
        
        return Response({'message': 'Asset deleted successfully'})


class AssetStatsView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'emp_asset'
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        assets = Asset.objects.filter(company_id=company_id, is_deleted=False)
        
        total_value = assets.aggregate(total=models.Sum('purchase_price'))['total'] or 0
        
        return Response({
            "totalAssets": assets.count(),
            "withSerialNumbers": assets.exclude(
                models.Q(serial_number__isnull=True) | models.Q(serial_number='')
            ).count(),
            "totalValue": total_value,
            "assignedAssets": assets.filter(is_assigned=True).count(),
            "availableAssets": assets.filter(is_assigned=False, is_active=True).count(),
            "uniqueVendors": assets.exclude(
                models.Q(vendor__isnull=True) | models.Q(vendor='')
            ).values('vendor').distinct().count(),
            "activeWarranty": sum(1 for a in assets if a.warranty_status is True),
            "expiredWarranty": sum(1 for a in assets if a.warranty_status is False),
            "categories": list(assets.exclude(category__isnull=True).exclude(category='').values_list('category', flat=True).distinct()),
        })