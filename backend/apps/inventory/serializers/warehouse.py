from rest_framework import serializers
from apps.inventory.models import Warehouse
from apps.hr.models import Employee


class WarehouseSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    
    # Read-only fields for employee info
    employee_id = serializers.UUIDField(source='employee._id', read_only=True, allow_null=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True, allow_null=True)
    
    # Writeable field to set employee via UUID
    employee_uuid = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Employee.objects.all(),
        source='employee',
        allow_null=True,
        required=False,
        write_only=True
    )
    
    class Meta:
        model = Warehouse
        fields = [
            "id", "warehouse_name", "code", 
            "employee_id", "employee_name", "employee_uuid",
            "landline_number", "country", "state", "city", 
            "address_line", "postal_code", "email", 
            "is_active", "description",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at", "employee_id", "employee_name"]