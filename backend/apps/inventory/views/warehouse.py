# apps/inventory/views/warehouse.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum
from apps.inventory.models import Warehouse
from apps.inventory.serializers import WarehouseSerializer

class WarehouseViewSet(viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Warehouse.objects.filter(
            company_id=user.company_id,
            branch_id=user.branch_id
        )
        
        # Search functionality
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(warehouse_name__icontains=search) | 
                Q(code__icontains=search) |
                Q(manager_name__icontains=search) |
                Q(city__icontains=search) |
                Q(country__icontains=search)
            )
        
        # Filter by status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Filter by country
        country = self.request.query_params.get('country')
        if country:
            queryset = queryset.filter(country__icontains=country)
        
        # Filter by city
        city = self.request.query_params.get('city')
        if city:
            queryset = queryset.filter(city__icontains=city)
        
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
            'message': f'Warehouse "{serializer.instance.warehouse_name}" has been created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Override update to return custom success message"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        self.perform_update(serializer)
        
        return Response({
            'status': 'success',
            'message': f'Warehouse "{serializer.instance.warehouse_name}" has been updated successfully.',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Override delete to return custom success message"""
        instance = self.get_object()
        warehouse_name = instance.warehouse_name
        
        self.perform_destroy(instance)
        
        return Response({
            'status': 'success',
            'message': f'Warehouse "{warehouse_name}" has been deleted successfully.'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get warehouse statistics"""
        user = request.user
        queryset = self.get_queryset()
        
        total_warehouses = queryset.count()
        active_warehouses = queryset.filter(is_active=True).count()
        total_capacity = queryset.aggregate(total=Sum('capacity'))['total'] or 0
        total_occupancy = queryset.aggregate(total=Sum('current_occupancy'))['total'] or 0
        
        return Response({
            'total_warehouses': total_warehouses,
            'active_warehouses': active_warehouses,
            'inactive_warehouses': total_warehouses - active_warehouses,
            'total_capacity': total_capacity,
            'total_occupancy': total_occupancy,
            'overall_occupancy_percentage': (total_occupancy / total_capacity * 100) if total_capacity > 0 else 0
        })

    @action(detail=True, methods=['get'])
    def utilization(self, request, pk=None):
        """Get detailed utilization for a specific warehouse"""
        warehouse = self.get_object()
        
        return Response({
            'id': warehouse.id,
            'name': warehouse.warehouse_name,
            'capacity': warehouse.capacity,
            'current_occupancy': warehouse.current_occupancy,
            'available_capacity': warehouse.available_capacity,
            'occupancy_percentage': warehouse.occupancy_percentage,
            'status': 'Optimal' if warehouse.occupancy_percentage < 80 else 'Critical' if warehouse.occupancy_percentage > 95 else 'Warning'
        })