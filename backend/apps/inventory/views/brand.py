# apps/inventory/views/brand.py
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from apps.inventory.models import Brand
from apps.inventory.serializers import BrandSerializer

class BrandViewSet(viewsets.ModelViewSet):
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Brand.objects.filter(
            company_id=user.company_id,
            branch_id=user.branch_id
        )
        
        # Add search functionality
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | 
                Q(code__icontains=search) |
                Q(country_of_origin__icontains=search)
            )
        
        return queryset

    def create(self, request, *args, **kwargs):
        """Override create to return custom success message"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        serializer.save(
            company_id=request.user.company_id,
            branch_id=request.user.branch_id
        )
        
        return Response({
            'status': 'success',
            'message': f'Brand "{serializer.instance.name}" has been created successfully.',
            'data': serializer.data
        }, status=201)

    def update(self, request, *args, **kwargs):
        """Override update to return custom success message"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        self.perform_update(serializer)
        
        return Response({
            'status': 'success',
            'message': f'Brand "{serializer.instance.name}" has been updated successfully.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        """Override delete to return custom success message"""
        instance = self.get_object()
        brand_name = instance.name
        
        self.perform_destroy(instance)
        
        return Response({
            'status': 'success',
            'message': f'Brand "{brand_name}" has been deleted successfully.'
        })

    def perform_create(self, serializer):
        pass  # Handled in create method

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()