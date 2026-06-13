# apps/inventory/views/category.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from apps.inventory.models import Category
from apps.inventory.serializers import CategorySerializer

class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Category.objects.filter(
            company_id=user.company_id,
            branch_id=user.branch_id
        )
        
        # Add search functionality
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(code__icontains=search)
            )
        
        return queryset

    def create(self, request, *args, **kwargs):
        """Override create to return custom success message"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Save with company and branch from user
        serializer.save(
            company_id=request.user.company_id,
            branch_id=request.user.branch_id
        )
        
        # Return custom response with message
        return Response({
            'status': 'success',
            'message': f'Category "{serializer.instance.name}" has been created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Override update to return custom success message"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        self.perform_update(serializer)
        
        # Return custom response with message
        return Response({
            'status': 'success',
            'message': f'Category "{serializer.instance.name}" has been updated successfully.',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Override delete to return custom success message"""
        instance = self.get_object()
        category_name = instance.name
        
        self.perform_destroy(instance)
        
        # Return custom response with message
        return Response({
            'status': 'success',
            'message': f'Category "{category_name}" has been deleted successfully.'
        }, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        # This method is no longer needed as we handle save in create()
        pass

    def perform_update(self, serializer):
        # This is now called from update() method
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()