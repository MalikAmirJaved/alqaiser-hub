from rest_framework import viewsets, status
from rest_framework.response import Response
from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models.customer import Customer
from apps.inventory.serializers.customer import CustomerSerializer

class CustomerViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    lookup_field = '_id'
    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(email__icontains=search)
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
            'message': f'Customer "{serializer.instance.name}" created.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        print(" the update are:: ", request.user.company_id)
        print(" request.user.branch_id:: ", request.user.branch_id)
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'status': 'success',
            'message': f'Customer "{serializer.instance.name}" updated.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name
        self.perform_destroy(instance)
        return Response({
            'status': 'success',
            'message': f'Customer "{name}" deleted.'
        })