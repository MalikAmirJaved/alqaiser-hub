from rest_framework import serializers
from .models import Designation

class DesignationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)

    # Expose department id (_id) and human name
    department_id = serializers.UUIDField(source='department._id', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    # Accept department (UUID) or 'ALL' from frontend to set FK
    department = serializers.CharField(write_only=True, required=False, allow_null=True)

    isActive = serializers.BooleanField(source='is_active')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Designation
        fields = ['id', 'name', 'department_id', 'department_name', 'department', 'description', 'isActive', 'createdAt', 'updatedAt']

    def _get_department_obj(self, dept_uuid):
        if dept_uuid is None:
            return None
        # Support receiving the string 'ALL' from older clients to mean no department
        if isinstance(dept_uuid, str) and dept_uuid.upper() == 'ALL':
            return None
        from apps.organization.models import Department
        try:
            return Department.objects.get(_id=dept_uuid, is_deleted=False)
        except Department.DoesNotExist:
            return None

    def create(self, validated_data):
        dept_uuid = validated_data.pop('department', None)
        if 'department' in self.initial_data:
            # explicit department provided
            dept_obj = self._get_department_obj(dept_uuid)
            validated_data['department'] = dept_obj
        return super().create(validated_data)

    def update(self, instance, validated_data):
        dept_uuid = validated_data.pop('department', None) if 'department' in self.initial_data else None
        if 'department' in self.initial_data:
            instance.department = self._get_department_obj(dept_uuid)
        return super().update(instance, validated_data)