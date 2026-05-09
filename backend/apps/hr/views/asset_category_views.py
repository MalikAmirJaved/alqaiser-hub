# apps/hr/views/asset_category_views.py
from datetime import datetime
from django.db import transaction, models
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging
from apps.hr.models import AssetCategory, Asset

logger = logging.getLogger(__name__)


class AssetCategoryView(APIView):
    """CRUD for Asset Categories/Kits"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get all asset categories for user's company"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Build query
        query = AssetCategory.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).prefetch_related('assets')
        
        # Non-admin users only see their branch categories or global
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            query = query.filter(
                models.Q(branch_id=branch_id) | models.Q(branch__isnull=True)
            )
        
        # Optional search
        search = request.query_params.get('search')
        if search:
            query = query.filter(
                models.Q(name__icontains=search) |
                models.Q(description__icontains=search)
            )
        
        categories = query.order_by('name')
        
        return Response([
            {
                "id": c.id,
                "_id": str(c._id),
                "name": c.name,
                "description": c.description,
                "isActive": c.is_active,
                "assetIds": c.get_asset_ids(),
                "assetCount": c.assets.count(),
                "assets": [
                    {
                        "id": a.id,
                        "name": a.name,
                        "brand": a.brand,
                        "model": a.model,
                        "serialNumber": a.serial_number,
                    }
                    for a in c.assets.filter(is_deleted=False)
                ],
                "createdAt": c.created_at.isoformat() if c.created_at else None,
                "updatedAt": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in categories
        ])
    
    @transaction.atomic
    def post(self, request):
        """Create new asset category"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate required fields
        if not request.data.get('name'):
            return Response(
                {'error': 'Category name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for duplicate name
        if AssetCategory.objects.filter(
            company_id=company_id,
            name=request.data['name'],
            is_deleted=False
        ).exists():
            return Response(
                {'error': 'Category with this name already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category = AssetCategory.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            name=request.data['name'],
            description=request.data.get('description', ''),
            is_active=request.data.get('isActive', True),
            created_by=request.user,
            updated_by=request.user,
        )
        
        # Add assets if provided
        asset_ids = request.data.get('assetIds', [])
        if asset_ids:
            assets = Asset.objects.filter(
                id__in=asset_ids,
                company_id=company_id,
                is_deleted=False
            )
            category.assets.set(assets)
        
        return Response({
            "message": "Category created successfully",
            "id": category.id,
            "_id": str(category._id),
            "name": category.name,
            "description": category.description,
            "isActive": category.is_active,
            "assetIds": category.get_asset_ids(),
            "assetCount": category.assets.count(),
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request):
        """Update asset category"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category_id = request.data.get('id')
        if not category_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category = get_object_or_404(
            AssetCategory,
            id=category_id,
            company_id=company_id,
            is_deleted=False
        )
        
        # Update basic fields
        if 'name' in request.data:
            category.name = request.data['name']
        if 'description' in request.data:
            category.description = request.data.get('description')
        if 'isActive' in request.data:
            category.is_active = request.data['isActive']
        
        # Update assets if provided
        if 'assetIds' in request.data:
            asset_ids = request.data['assetIds']
            if asset_ids:
                assets = Asset.objects.filter(
                    id__in=asset_ids,
                    company_id=company_id,
                    is_deleted=False
                )
                category.assets.set(assets)
            else:
                category.assets.clear()
        
        category.updated_by = request.user
        category.save()
        
        return Response({
            "message": "Category updated successfully",
            "id": category.id,
            "name": category.name,
            "description": category.description,
            "isActive": category.is_active,
            "assetIds": category.get_asset_ids(),
            "assetCount": category.assets.count(),
        })
    
    @transaction.atomic
    def delete(self, request):
        """Soft delete asset category"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category_id = request.data.get('id')
        if not category_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category = get_object_or_404(
            AssetCategory,
            id=category_id,
            company_id=company_id,
            is_deleted=False
        )
        
        # Check if category has active assignments
        # You may want to add this check when employee assignments are implemented
        
        category.is_deleted = True
        category.deleted_at = datetime.now()
        category.deleted_by = request.user
        category.save()
        
        return Response({'message': 'Category deleted successfully'})


class AssetCategoryStatsView(APIView):
    """Get asset category statistics"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        categories = AssetCategory.objects.filter(
            company_id=company_id,
            is_deleted=False
        )
        
        total_assets_in_categories = sum(c.assets.count() for c in categories)
        
        return Response({
            "totalCategories": categories.count(),
            "activeCategories": categories.filter(is_active=True).count(),
            "totalAssetsInCategories": total_assets_in_categories,
            "averageAssetsPerCategory": round(total_assets_in_categories / categories.count(), 2) if categories.count() > 0 else 0,
        })