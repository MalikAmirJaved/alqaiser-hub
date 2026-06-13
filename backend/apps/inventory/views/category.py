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

    def perform_create(self, serializer):
        serializer.save(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id
        )

    def perform_update(self, serializer):
        serializer.save()