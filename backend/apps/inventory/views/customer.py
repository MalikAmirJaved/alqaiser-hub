from rest_framework import viewsets, status
from rest_framework.response import Response
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models.customer import Customer
from apps.inventory.serializers.customer import CustomerSerializer
import uuid

class CustomerViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'customer'
    action_permission_any_of = {
        "": [("SALES", "sales_customer")],
    }
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    lookup_field = '_id'
    filter_fields = {
        'search': ['name', 'customer_code', 'email', 'phone', 'contact_person'],
        'is_active': 'is_active',
        'country': 'country__icontains',
        'city': 'city__icontains',
    }

    def generate_customer_code(self, company_id, branch_id):
        """
        Generates a unique customer code like:
        CUST-7F3A91K2
        """
        while True:
            code = f"CUST-{uuid.uuid4().hex[:8].upper()}"

            exists = Customer.objects.filter(
                company_id=company_id,
                branch_id=branch_id,
                customer_code=code
            ).exists()

            if not exists:
                return code

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        company_id = request.user.company_id
        branch_id = request.user.branch_id

        customer_code = self.generate_customer_code(company_id, branch_id)

        serializer.save(
            company_id=company_id,
            branch_id=branch_id,
            created_by=request.user,
            updated_by=request.user,
            customer_code=customer_code,  
        )

        return Response({
            'status': 'success',
            'message': f'Customer "{serializer.instance.name}" created.',
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
            'message': f'Customer "{serializer.instance.name}" updated.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])

        return Response({
            'status': 'success',
            'message': f'Customer "{instance.name}" deleted (soft).'
        }, status=status.HTTP_200_OK)