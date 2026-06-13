# apps/organization/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Branch, Department
from apps.compsetting.models import Designation
User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    # Accept department and designation as UUID from frontend (write-only). This overrides the default FK mapping which expects PK.
    department = serializers.UUIDField(write_only=True, required=False)
    designation = serializers.UUIDField(write_only=True, required=False)

    branch_id = serializers.UUIDField(source='branch._id', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    department_id = serializers.UUIDField(source='department._id', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    password = serializers.CharField(write_only=True, required=False, min_length=6)
    designation_id = serializers.UUIDField(source='designation._id', read_only=True)
    designation_name = serializers.CharField(source='designation.name', read_only=True)
    # If this user was created from an employee, expose that relationship (read-only)
    isfrom_employee_id = serializers.UUIDField(source='isfrom_employee._id', read_only=True)
    isfrom_employee_name = serializers.CharField(source='isfrom_employee.full_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', '_id', 'username', 'email', 'first_name', 'last_name',
            'department', 'department_id', 'department_name', 'designation', 'phone_number',
            'is_active', 'branch_id', 'branch_name', 'created_at', 'updated_at',
            'password','designation_id', 'designation_name', 'isfrom_employee_id', 'isfrom_employee_name'
        ]
        read_only_fields = ['id', '_id', 'created_at', 'updated_at', 'branch_id', 'branch_name', 'department_id', 'department_name', 'isfrom_employee_id', 'isfrom_employee_name']
        extra_kwargs = {'password': {'write_only': True}}

    def _get_department(self, department_value):
        """Convert a department UUID string or existing Department instance to a Department instance."""
        if department_value is None or department_value == "":
            return None
        if isinstance(department_value, Department):
            return department_value
        # Assume it's a UUID string
        try:
            return Department.objects.get(_id=department_value, is_deleted=False)
        except Department.DoesNotExist:
            return None

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        # department may come as UUID via 'department' key (handled by _get_department)
        department_value = validated_data.pop('department', None)
        department = self._get_department(department_value)

        # designation is expected as UUID in 'designation' (write-only field)
        designation_uuid = validated_data.pop('designation', None)
        designation = None
        if designation_uuid:
            try:
                designation = Designation.objects.get(_id=designation_uuid, is_deleted=False)
            except Designation.DoesNotExist:
                designation = None

        # Set default values
        validated_data['role'] = 'STAFF'
        validated_data['is_staff'] = True
        validated_data['is_superuser'] = False
        validated_data['is_active'] = True

        # Build user instance
        user = User(**validated_data, department=department, designation=designation)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()

        # If an employee exists with this user's email in the same company, link them both ways
        try:
            from apps.hr.models import Employee
            employee = None
            # Priority 1: explicit id passed from frontend (when navigating from employee -> user)
            explicit_emp_id = None
            try:
                explicit_emp_id = self.initial_data.get('isfrom_employee_id')
            except Exception:
                explicit_emp_id = None

            if explicit_emp_id:
                try:
                    employee = Employee.objects.get(_id=explicit_emp_id, company_id=user.company_id, is_deleted=False)
                except Employee.DoesNotExist:
                    employee = None

            # Fallback: match by email
            if not employee and user.email:
                employee = Employee.objects.filter(email=user.email, company_id=user.company_id, is_deleted=False).first()

            if employee:
                user.isfrom_employee = employee
                user.save()
                employee.isfrom_user = user
                employee.save()
        except Exception:
            # If HR app not available or linking fails, ignore silently
            pass

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        department_value = validated_data.pop('department', None)

        # Handle designation UUID if present
        designation_uuid = validated_data.pop('designation', None)
        if designation_uuid is not None:
            try:
                instance.designation = Designation.objects.get(_id=designation_uuid, is_deleted=False)
            except Designation.DoesNotExist:
                instance.designation = None

        if department_value is not None:
            instance.department = self._get_department(department_value)

        # Update other fields
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.email = validated_data.get('email', instance.email)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.is_active = validated_data.get('is_active', instance.is_active)

        # If an explicit isfrom_employee_id was passed (e.g., linked from employee page), link both ways
        try:
            explicit_emp_id = None
            try:
                explicit_emp_id = self.initial_data.get('isfrom_employee_id')
            except Exception:
                explicit_emp_id = None
            if explicit_emp_id:
                from apps.hr.models import Employee
                try:
                    employee = Employee.objects.get(_id=explicit_emp_id, company_id=instance.company_id, is_deleted=False)
                    instance.isfrom_employee = employee
                    instance.save()
                    employee.isfrom_user = instance
                    employee.save()
                except Employee.DoesNotExist:
                    pass
        except Exception:
            pass

        if password:
            instance.set_password(password)

        instance.save()
        return instance


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = [
            'id', '_id', 'name', 'code', 'address', 'city', 'state', 'country',
            'phone', 'email', 'is_hq', 'currency_code', 'tax_id',
            'created_by', 'updated_by'
        ]
        read_only_fields = ['id', '_id', 'created_by', 'updated_by']

    def validate_code(self, value):
        company = self.context.get('company')
        if company and Branch.objects.filter(company=company, code=value).exists():
            raise serializers.ValidationError("Branch code already exists for this company")
        return value

    def validate_name(self, value):
        company = self.context.get('company')
        if company and Branch.objects.filter(company=company, name=value).exists():
            raise serializers.ValidationError("Branch name already exists for this company")
        return value

    def create(self, validated_data):
        validated_data.pop("created_by", None)
        validated_data.pop("updated_by", None)
        return super().create(validated_data)


class DepartmentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'code', 'description', 'is_active',
            'created_at', 'updated_at', 'created_by', 'updated_by'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']