# apps/hr/views/asset_views.py
from datetime import datetime, date
from django.db import transaction, models
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

logger = logging.getLogger(__name__)


class AssetView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'emp_asset'
    """CRUD for HR Assets with UUID support"""
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
        
        # Non-admin users only see their branch assets
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            query = query.filter(models.Q(branch_id=branch_id) | models.Q(branch_id__isnull=True))
        
        # Filters
        vendor = request.query_params.get('vendor')
        is_assigned = request.query_params.get('is_assigned')
        search = request.query_params.get('search')
        
        if vendor:
            query = query.filter(vendor__iexact=vendor)
        if is_assigned is not None:
            query = query.filter(is_assigned=is_assigned.lower() == 'true')
        if search:
            query = query.filter(
                models.Q(name__icontains=search) |
                models.Q(brand__icontains=search) |
                models.Q(model__icontains=search) |
                models.Q(serial_number__icontains=search) |
                models.Q(vendor__icontains=search)
            )
        
        assets = query.order_by('-created_at')
        
        return Response([
            {
                "id": str(a._id),
                "name": a.name,
                "brand": a.brand,
                "model": a.model,
                "serialNumber": a.serial_number,
                "description": a.description,
                "purchaseDate": a.purchase_date.isoformat() if a.purchase_date else None,
                "purchasePrice": str(a.purchase_price) if a.purchase_price else None,
                "warrantyUntil": a.warranty_until.isoformat() if a.warranty_until else None,
                "vendor": a.vendor,
                "isActive": a.is_active,
                "isAssigned": a.is_assigned,
                "warrantyStatus": a.warranty_status,
                "createdAt": a.created_at.isoformat() if a.created_at else None,
                "updatedAt": a.updated_at.isoformat() if a.updated_at else None,
            }
            for a in assets
        ])
    
    @transaction.atomic
    def post(self, request):
        """Create new asset"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not request.data.get('name'):
            return Response(
                {'error': 'Asset name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serial_number = request.data.get('serialNumber')
        if serial_number:
            if Asset.objects.filter(serial_number=serial_number, is_deleted=False).exists():
                return Response(
                    {'error': 'Asset with this serial number already exists'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Parse dates
        purchase_date = None
        warranty_until = None
        
        if request.data.get('purchaseDate'):
            try:
                purchase_date = datetime.strptime(request.data['purchaseDate'], '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid purchase date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if request.data.get('warrantyUntil'):
            try:
                warranty_until = datetime.strptime(request.data['warrantyUntil'], '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid warranty date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        asset = Asset.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            name=request.data['name'],
            brand=request.data.get('brand'),
            model=request.data.get('model'),
            serial_number=serial_number,
            description=request.data.get('description'),
            purchase_date=purchase_date,
            purchase_price=request.data.get('purchasePrice'),
            warranty_until=warranty_until,
            vendor=request.data.get('vendor'),
            is_active=request.data.get('isActive', True),
            created_by=request.user,
            updated_by=request.user,
        )
        
        return Response({
            "message": "Asset created successfully",
            "id": str(asset._id),
            "name": asset.name,
            "brand": asset.brand,
            "model": asset.model,
            "serialNumber": asset.serial_number,
            "purchaseDate": asset.purchase_date.isoformat() if asset.purchase_date else None,
            "purchasePrice": str(asset.purchase_price) if asset.purchase_price else None,
            "warrantyUntil": asset.warranty_until.isoformat() if asset.warranty_until else None,
            "vendor": asset.vendor,
            "isActive": asset.is_active,
            "isAssigned": asset.is_assigned,
            "warrantyStatus": asset.warranty_status,
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
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
        
        # Update basic fields
        if 'name' in request.data:
            asset.name = request.data['name']
        if 'brand' in request.data:
            asset.brand = request.data.get('brand')
        if 'model' in request.data:
            asset.model = request.data.get('model')
        if 'serialNumber' in request.data:
            new_serial = request.data['serialNumber']
            if new_serial and new_serial != asset.serial_number:
                if Asset.objects.filter(serial_number=new_serial, is_deleted=False).exclude(_id=asset_uuid).exists():
                    return Response(
                        {'error': 'Asset with this serial number already exists'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            asset.serial_number = new_serial or None
        if 'description' in request.data:
            asset.description = request.data.get('description')
        if 'vendor' in request.data:
            asset.vendor = request.data.get('vendor')
        if 'isActive' in request.data:
            asset.is_active = request.data['isActive']
        if 'isAssigned' in request.data:
            asset.is_assigned = request.data['isAssigned']
        
        # Parse dates
        if 'purchaseDate' in request.data:
            try:
                asset.purchase_date = datetime.strptime(
                    request.data['purchaseDate'], '%Y-%m-%d'
                ).date() if request.data['purchaseDate'] else None
            except ValueError:
                return Response(
                    {'error': 'Invalid purchase date format'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if 'purchasePrice' in request.data:
            asset.purchase_price = request.data.get('purchasePrice') or None
        
        if 'warrantyUntil' in request.data:
            try:
                asset.warranty_until = datetime.strptime(
                    request.data['warrantyUntil'], '%Y-%m-%d'
                ).date() if request.data['warrantyUntil'] else None
            except ValueError:
                return Response(
                    {'error': 'Invalid warranty date format'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        asset.updated_by = request.user
        asset.save()
        
        return Response({
            "message": "Asset updated successfully",
            "id": str(asset._id),
            "name": asset.name,
            "brand": asset.brand,
            "model": asset.model,
            "serialNumber": asset.serial_number,
            "purchaseDate": asset.purchase_date.isoformat() if asset.purchase_date else None,
            "purchasePrice": str(asset.purchase_price) if asset.purchase_price else None,
            "warrantyUntil": asset.warranty_until.isoformat() if asset.warranty_until else None,
            "vendor": asset.vendor,
            "isActive": asset.is_active,
            "isAssigned": asset.is_assigned,
            "warrantyStatus": asset.warranty_status,
        })
    
    @transaction.atomic
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
    """Get asset statistics"""
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
        })