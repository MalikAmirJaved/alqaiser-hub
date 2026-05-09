# apps/hr/views/employee_views.py
from datetime import datetime, date
from django.db import transaction, models
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging
from apps.hr.models import Employee, EmployeeDefaultShift, EmployeeAssetAssignment, Asset, AssetCategory, ShiftTemplate

logger = logging.getLogger(__name__)


class EmployeeView(APIView):
    """CRUD for Employees"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get all employees for user's company"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = Employee.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('default_shift', 'reporting_manager')
        
        # Non-admin users only see their branch employees
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            query = query.filter(
                models.Q(branch_id=branch_id) | models.Q(branch__isnull=True)
            )
        
        # Search
        search = request.query_params.get('search')
        if search:
            query = query.filter(
                models.Q(employee_id__icontains=search) |
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(department__icontains=search) |
                models.Q(designation__icontains=search) |
                models.Q(email__icontains=search)
            )
        
        # Filters
        department = request.query_params.get('department')
        status_filter = request.query_params.get('status')
        employment_type = request.query_params.get('employmentType')
        
        if department:
            query = query.filter(department=department)
        if status_filter:
            query = query.filter(employment_status=status_filter)
        if employment_type:
            query = query.filter(employment_type=employment_type)
        
        employees = query.order_by('first_name', 'last_name')
        
        return Response([
            self._serialize_employee(e) for e in employees
        ])
    
    def _serialize_employee(self, employee):
        """Serialize employee with default shift info"""
        # Get active default shift
        today = date.today()
        active_default_shift = employee.default_shifts.filter(
            effective_from__lte=today,
            is_deleted=False
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
        ).select_related('template').first()
        
        # Safely get reporting manager
        reporting_manager_name = None
        reporting_manager_id = None
        if employee.reporting_manager_id and employee.reporting_manager:
            reporting_manager_id = employee.reporting_manager.id
            reporting_manager_name = employee.reporting_manager.full_name
        
        return {
            "id": employee.id,
            "_id": str(employee._id),
            "employee_id": employee.employee_id,
            "first_name": employee.first_name,
            "last_name": employee.last_name,
            "father_name": employee.father_name,
            "cnic": employee.cnic,
            "date_of_birth": employee.date_of_birth.isoformat() if employee.date_of_birth else None,
            "gender": employee.gender,
            "marital_status": employee.marital_status,
            "phone": employee.phone,
            "email": employee.email,
            "personal_email": employee.personal_email,
            "address_line": employee.address_line,
            "country": employee.country,
            "state": employee.state,
            "city": employee.city,
            "postal_code": employee.postal_code,
            "emergency_contact_name": employee.emergency_contact_name,
            "emergency_contact_phone": employee.emergency_contact_phone,
            "emergency_contact_relation": employee.emergency_contact_relation,
            "role": employee.role,
            "department": employee.department,
            "designation": employee.designation,
            "employment_type": employee.employment_type,
            "employment_status": employee.employment_status,
            "joining_date": employee.joining_date.isoformat() if employee.joining_date else None,
            "confirmation_date": employee.confirmation_date.isoformat() if employee.confirmation_date else None,
            "probation_days": employee.probation_days,
            "work_location": employee.work_location,
            "reporting_manager_id": reporting_manager_id,
            "reporting_manager_name": reporting_manager_name,
            "default_shift_id": active_default_shift.template_id if active_default_shift else employee.default_shift_id,
            "default_shift_name": active_default_shift.template.name if active_default_shift and active_default_shift.template else None,
            "bank_name": employee.bank_name,
            "bank_account_number": employee.bank_account_number,
            "bank_iban": employee.bank_iban,
            "salary": str(employee.salary),
            "createdAt": employee.created_at.isoformat() if employee.created_at else None,
            "updatedAt": employee.updated_at.isoformat() if employee.updated_at else None,
        }

    @transaction.atomic
    def post(self, request):
        """Create new employee"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate required fields
        required_fields = ['first_name', 'phone', 'department', 'joining_date']
        for field in required_fields:
            if not request.data.get(field):
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Generate employee ID if not provided
        employee_id = request.data.get('employee_id')
        if not employee_id:
            count = Employee.objects.filter(company_id=company_id, is_deleted=False).count()
            employee_id = f"EMP-{str(count + 1).zfill(3)}"
        
        # Check for duplicate employee ID
        if Employee.objects.filter(company_id=company_id, employee_id=employee_id, is_deleted=False).exists():
            return Response(
                {'error': 'Employee ID already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse dates
        joining_date = request.data.get('joining_date')
        if joining_date:
            joining_date = datetime.strptime(joining_date, '%Y-%m-%d').date()
        
        date_of_birth = None
        if request.data.get('date_of_birth'):
            date_of_birth = datetime.strptime(request.data['date_of_birth'], '%Y-%m-%d').date()
        
        confirmation_date = None
        if request.data.get('confirmation_date'):
            confirmation_date = datetime.strptime(request.data['confirmation_date'], '%Y-%m-%d').date()
        
        # Handle empty strings for ForeignKey fields
        reporting_manager_id = request.data.get('reporting_manager_id')
        if reporting_manager_id == '' or reporting_manager_id is None:
            reporting_manager_id = None
        
        default_shift_id = request.data.get('default_shift_id')
        if default_shift_id == '' or default_shift_id is None:
            default_shift_id = None
        
        employee = Employee.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            employee_id=employee_id,
            first_name=request.data['first_name'],
            last_name=request.data.get('last_name'),
            father_name=request.data.get('father_name'),
            cnic=request.data.get('cnic'),
            date_of_birth=date_of_birth,
            gender=request.data.get('gender', 'MALE'),
            marital_status=request.data.get('marital_status', 'SINGLE'),
            phone=request.data['phone'],
            email=request.data.get('email'),
            personal_email=request.data.get('personal_email'),
            address_line=request.data.get('address_line'),
            country=request.data.get('country', 'PK'),
            state=request.data.get('state'),
            city=request.data.get('city'),
            postal_code=request.data.get('postal_code'),
            emergency_contact_name=request.data.get('emergency_contact_name'),
            emergency_contact_phone=request.data.get('emergency_contact_phone'),
            emergency_contact_relation=request.data.get('emergency_contact_relation'),
            role=request.data.get('role', 'STAFF'),
            department=request.data['department'],
            designation=request.data.get('designation'),
            employment_type=request.data.get('employment_type', 'FULL_TIME'),
            employment_status=request.data.get('employment_status', 'ACTIVE'),
            joining_date=joining_date,
            confirmation_date=confirmation_date,
            probation_days=request.data.get('probation_days', 180),
            work_location=request.data.get('work_location', 'OFFICE'),
            reporting_manager_id=reporting_manager_id,
            default_shift_id=default_shift_id,
            bank_name=request.data.get('bank_name'),
            bank_account_number=request.data.get('bank_account_number'),
            bank_iban=request.data.get('bank_iban'),
            salary=request.data.get('salary', 0),
            created_by=request.user,
            updated_by=request.user,
        )
        
        # Create default shift record if provided
        if default_shift_id and joining_date:
            EmployeeDefaultShift.objects.create(
                company_id=company_id,
                employee=employee,
                template_id=default_shift_id,
                effective_from=joining_date,
                created_by=request.user,
                updated_by=request.user,
            )
        
        # Assign assets from kit if provided
        asset_category_id = request.data.get('asset_category_id')
        if asset_category_id and asset_category_id != '':
            self._assign_assets_from_category(employee, asset_category_id, request.user)
        
        return Response({
            "message": "Employee created successfully",
            "employee": self._serialize_employee(employee),
        }, status=status.HTTP_201_CREATED)

    def _assign_assets_from_category(self, employee, category_id, user):
        """Assign all assets from a category to an employee"""
        try:
            category = AssetCategory.objects.get(
                id=category_id,
                company_id=employee.company_id,
                is_deleted=False
            )
            
            for asset in category.assets.filter(is_deleted=False, is_assigned=False):
                EmployeeAssetAssignment.objects.create(
                    company_id=employee.company_id,
                    branch_id=employee.branch_id,
                    employee=employee,
                    asset=asset,
                    category=category,
                    assigned_date=date.today(),
                    status='ACTIVE',
                    condition='NEW',
                    notes=f"Assigned via kit: {category.name}",
                    created_by=user,
                    updated_by=user,
                )
                
                # Mark asset as assigned
                asset.is_assigned = True
                asset.save()
                
        except AssetCategory.DoesNotExist:
            pass
    
    @transaction.atomic
    def patch(self, request):
        """Update employee"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.data.get('id')
        if not employee_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee = get_object_or_404(
            Employee,
            id=employee_id,
            company_id=company_id,
            is_deleted=False
        )
        
        # Update fields with empty string handling
        updatable_fields = [
            'first_name', 'last_name', 'father_name', 'cnic',
            'gender', 'marital_status', 'phone', 'email', 'personal_email',
            'address_line', 'country', 'state', 'city', 'postal_code',
            'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
            'role', 'department', 'designation', 'employment_type', 'employment_status',
            'work_location', 'bank_name', 'bank_account_number', 'bank_iban', 'salary',
            'probation_days',
        ]
        
        for field in updatable_fields:
            if field in request.data:
                setattr(employee, field, request.data[field])
        
        # Handle ForeignKey fields with empty string
        if 'reporting_manager_id' in request.data:
            value = request.data['reporting_manager_id']
            employee.reporting_manager_id = None if value == '' or value is None else value
        
        if 'default_shift_id' in request.data:
            value = request.data['default_shift_id']
            employee.default_shift_id = None if value == '' or value is None else value
        
        # Parse dates
        if 'date_of_birth' in request.data:
            val = request.data['date_of_birth']
            employee.date_of_birth = datetime.strptime(val, '%Y-%m-%d').date() if val else None
        
        if 'joining_date' in request.data:
            val = request.data['joining_date']
            employee.joining_date = datetime.strptime(val, '%Y-%m-%d').date() if val else None
        
        if 'confirmation_date' in request.data:
            val = request.data['confirmation_date']
            employee.confirmation_date = datetime.strptime(val, '%Y-%m-%d').date() if val else None
        
        employee.updated_by = request.user
        employee.save()
        
        # Handle default shift change
        old_default_shift_id = request.data.get('old_default_shift_id')
        new_default_shift_id = request.data.get('default_shift_id')
        
        # Convert empty strings to None for comparison
        if old_default_shift_id == '':
            old_default_shift_id = None
        if new_default_shift_id == '':
            new_default_shift_id = None
        
        if new_default_shift_id is not None and str(new_default_shift_id) != str(old_default_shift_id):
            # End previous active default shifts
            today = date.today()
            EmployeeDefaultShift.objects.filter(
                employee=employee,
                effective_to__isnull=True,
                is_deleted=False
            ).update(effective_to=today)
            
            # Create new default shift
            EmployeeDefaultShift.objects.create(
                company_id=company_id,
                employee=employee,
                template_id=new_default_shift_id,
                effective_from=today,
                created_by=request.user,
                updated_by=request.user,
            )
        
        return Response({
            "message": "Employee updated successfully",
            "employee": self._serialize_employee(employee),
        })
    
    @transaction.atomic
    def delete(self, request):
        """Soft delete employee"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.data.get('id')
        if not employee_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee = get_object_or_404(
            Employee,
            id=employee_id,
            company_id=company_id,
            is_deleted=False
        )
        
        # Check for active asset assignments
        active_assignments = employee.asset_assignments.filter(status='ACTIVE')
        if active_assignments.exists():
            return Response(
                {'error': 'Cannot delete employee with active asset assignments. Please return assets first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee.is_deleted = True
        employee.deleted_at = datetime.now()
        employee.deleted_by = request.user
        employee.save()
        
        return Response({'message': 'Employee deleted successfully'})


class EmployeeStatsView(APIView):
    """Get employee statistics"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employees = Employee.objects.filter(
            company_id=company_id,
            is_deleted=False
        )
        
        return Response({
            "totalEmployees": employees.count(),
            "activeEmployees": employees.filter(employment_status='ACTIVE').count(),
            "onLeave": employees.filter(employment_status='ON_LEAVE').count(),
            "departments": employees.values('department').distinct().count(),
            "withDefaultShift": employees.filter(default_shift__isnull=False).count() + 
                               EmployeeDefaultShift.objects.filter(
                                   employee__company_id=company_id,
                                   effective_to__isnull=True,
                                   is_deleted=False
                               ).values('employee').distinct().count(),
            "byDepartment": list(employees.values('department').annotate(count=models.Count('id')).order_by('-count')),
            "byStatus": list(employees.values('employment_status').annotate(count=models.Count('id'))),
        })