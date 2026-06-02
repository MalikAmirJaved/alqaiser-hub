# apps/hr/serializers/shift_serializers.py
from rest_framework import serializers
from datetime import date, timedelta
from apps.hr.models import (
    ShiftTemplate, Employee, EmployeeDefaultShift, 
    ShiftOverride, ShiftDateRangeAssignment, 
    ShiftChangeHistory, EmployeeShiftSchedule
)


class ShiftTemplateSerializer(serializers.ModelSerializer):
    startTime = serializers.TimeField(source='start_time', format='%H:%M')
    endTime = serializers.TimeField(source='end_time', format='%H:%M')
    breakMinutes = serializers.IntegerField(source='break_minutes')
    is_active = serializers.BooleanField(source='is_active')
    workingHours = serializers.SerializerMethodField()
    
    class Meta:
        model = ShiftTemplate
        fields = [
            'id', '_id', 'name', 'startTime', 'endTime', 
            'breakMinutes', 'description', 'is_active', 'workingHours',
            'createdAt', 'updatedAt'
        ]
    
    def get_workingHours(self, obj):
        return obj.working_hours
    
    def create(self, validated_data):
        validated_data['company'] = self.context['request'].user.company
        validated_data['created_by'] = self.context['request'].user
        validated_data['updated_by'] = self.context['request'].user
        return super().create(validated_data)


class EmployeeDefaultShiftSerializer(serializers.ModelSerializer):
    template_id = serializers.IntegerField()
    effective_from = serializers.DateField()
    effective_to = serializers.DateField(required=False, allow_null=True)
    
    class Meta:
        model = EmployeeDefaultShift
        fields = ['id', '_id', 'employee_id', 'template_id', 
                  'effective_from', 'effective_to']
    
    def validate(self, data):
        if data.get('effective_to') and data['effective_to'] < data['effective_from']:
            raise serializers.ValidationError("End date cannot be before start date")
        return data


class ShiftOverrideSerializer(serializers.ModelSerializer):
    employee_id = serializers.IntegerField(source='employee.id')
    template_id = serializers.IntegerField(source='shift_template.id')
    date = serializers.DateField()
    reason = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = ShiftOverride
        fields = ['id', '_id', 'employee_id', 'template_id', 'date', 'reason', 'notes']
    
    def validate(self, data):
        # Check for existing override
        if ShiftOverride.objects.filter(
            employee_id=data['employee'].id,
            date=data['date']
        ).exists():
            raise serializers.ValidationError("Override already exists for this date")
        return data


class ShiftDateRangeSerializer(serializers.ModelSerializer):
    employee_id = serializers.IntegerField(source='employee.id')
    template_id = serializers.IntegerField(source='shift_template.id')
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    reason = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = ShiftDateRangeAssignment
        fields = ['id', '_id', 'employee_id', 'template_id', 
                  'start_date', 'end_date', 'reason', 'notes', 'is_active']
    
    def validate(self, data):
        if data['end_date'] < data['start_date']:
            raise serializers.ValidationError("End date cannot be before start date")
        if (data['end_date'] - data['start_date']).days > 365:
            raise serializers.ValidationError("Date range cannot exceed 365 days")
        return data


class ShiftChangeHistorySerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    from_template_name = serializers.CharField(read_only=True)
    to_template_name = serializers.CharField(read_only=True)
    changed_by_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = ShiftChangeHistory
        fields = [
            'id', '_id', 'employee_id', 'employee_name', 'change_type',
            'from_template_id', 'from_template_name', 'to_template_id', 'to_template_name',
            'effective_from', 'effective_to', 'reason', 'notes', 'metadata',
            'changed_by', 'changed_by_name', 'changed_at'
        ]


class EmployeeShiftScheduleSerializer(serializers.ModelSerializer):
    shift_name = serializers.CharField()
    start_time = serializers.TimeField(format='%H:%M')
    end_time = serializers.TimeField(format='%H:%M')
    is_override = serializers.SerializerMethodField()
    
    class Meta:
        model = EmployeeShiftSchedule
        fields = [
            'id', 'employee_id', 'shift_template_id', 'shift_name',
            'date', 'start_time', 'end_time', 'break_minutes',
            'working_hours', 'source_type', 'is_override'
        ]
    
    def get_is_override(self, obj):
        return obj.source_type != 'DEFAULT'


class BulkShiftAssignmentSerializer(serializers.Serializer):
    employee_ids = serializers.ListField(child=serializers.IntegerField())
    template_id = serializers.IntegerField()
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False)
    assignment_type = serializers.ChoiceField(choices=['OVERRIDE', 'DATE_RANGE'])
    reason = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        if data.get('end_date') and data['end_date'] < data['start_date']:
            raise serializers.ValidationError("End date cannot be before start date")
        return data


class ResolvedShiftResponseSerializer(serializers.Serializer):
    """Serializer for resolved shifts on a date"""
    employee_id = serializers.IntegerField()
    employee_name = serializers.CharField()
    template_id = serializers.IntegerField(allow_null=True)
    template_name = serializers.CharField(allow_null=True)
    template_color = serializers.CharField(allow_null=True)
    start_time = serializers.TimeField(format='%H:%M', allow_null=True)
    end_time = serializers.TimeField(format='%H:%M', allow_null=True)
    is_override = serializers.BooleanField(default=False)
    source_type = serializers.CharField()