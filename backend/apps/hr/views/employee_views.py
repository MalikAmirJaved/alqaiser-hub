# apps/hr/views/employee_views.py
from datetime import datetime, date
from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging
import json
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.hr.models import Employee, EmployeeDefaultShift, EmployeeAssetAssignment, AssetCategory, RecruitmentCandidate, EmployeeDocument
from apps.organization.models import Department
from apps.compsetting.models import Designation   # <-- ADDED
import traceback

logger = logging.getLogger(__name__)


def serialize_employee(employee):
    """Serialize employee with UUID as id, department and designation as objects."""
    today = date.today()
    active_default_shift = employee.default_shifts.filter(
        effective_from__lte=today, is_deleted=False
    ).filter(
        models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
    ).select_related('template').first()

    reporting_manager_id = None
    reporting_manager_name = None
    if employee.reporting_manager_id and employee.reporting_manager:
        reporting_manager_id = str(employee.reporting_manager._id)
        reporting_manager_name = employee.reporting_manager.full_name

    return {
        "id": str(employee._id),
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
        "department_id": str(employee.department._id) if employee.department else None,
        "department_name": employee.department.name if employee.department else None,
        "designation_id": str(employee.designation._id) if employee.designation else None,
        "designation_name": employee.designation.name if employee.designation else None,
        "employment_type": employee.employment_type,
        "employment_status": employee.employment_status,
        "joining_date": employee.joining_date.isoformat() if employee.joining_date else None,
        "confirmation_date": employee.confirmation_date.isoformat() if employee.confirmation_date else None,
        "probation_days": employee.probation_days,
        "work_location": employee.work_location,
        "reporting_manager_id": reporting_manager_id,
        "reporting_manager_name": reporting_manager_name,
        "default_shift_id": str(active_default_shift.template._id) if active_default_shift and active_default_shift.template else (str(employee.default_shift._id) if employee.default_shift else None),
        "default_shift_name": active_default_shift.template.name if active_default_shift and active_default_shift.template else (employee.default_shift.name if employee.default_shift else None),
        "bank_name": employee.bank_name,
        "bank_account_number": employee.bank_account_number,
        "bank_iban": employee.bank_iban,
        "salary": str(employee.salary),
        "profile_picture": employee.profile_picture or "",
        "profile_picture_thumb": employee.profile_picture_thumb or "",
        "education_documents": [
            {
                "id": str(doc._id),
                "title": doc.title,
                "file_url": doc.file_url,
                "file_url_thumb": doc.file_url_thumb or "",
                "original_filename": doc.original_filename,
                "file_size": doc.file_size,
                "mime_type": doc.mime_type,
            }
            for doc in employee.documents.filter(document_type='EDUCATION', is_deleted=False)
        ],
        "experience_documents": [
            {
                "id": str(doc._id),
                "title": doc.title,
                "file_url": doc.file_url,
                "file_url_thumb": doc.file_url_thumb or "",
                "original_filename": doc.original_filename,
                "file_size": doc.file_size,
                "mime_type": doc.mime_type,
            }
            for doc in employee.documents.filter(document_type='EXPERIENCE', is_deleted=False)
        ],
        "isfrom_user_id": str(employee.isfrom_user._id) if getattr(employee, 'isfrom_user', None) else None,
        "isfrom_user_email": employee.isfrom_user.email if getattr(employee, 'isfrom_user', None) else None,
        "createdAt": employee.created_at.isoformat() if employee.created_at else None,
        "updatedAt": employee.updated_at.isoformat() if employee.updated_at else None,
    }


class EmployeeView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'employee'
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id

        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )

        query = Employee.objects.filter(company_id=company_id, is_deleted=False).select_related(
            'default_shift', 'reporting_manager', 'department', 'designation'
        )

        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            query = query.filter(models.Q(branch_id=branch_id) | models.Q(branch_id__isnull=True))

        # Apply filters using GenericFilterMixin logic
        search = request.query_params.get('search')
        if search:
            query = query.filter(
                models.Q(employee_id__icontains=search) |
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(department__name__icontains=search) |
                models.Q(designation__name__icontains=search) |
                models.Q(email__icontains=search)
            )

        # Support UUID-based department filter (department___id)
        department_uuid = request.query_params.get('department')
        if department_uuid:
            try:
                dept = Department.objects.get(_id=department_uuid, company_id=company_id, is_deleted=False)
                query = query.filter(department=dept)
            except Department.DoesNotExist:
                pass

        status_filter = request.query_params.get('status')
        if status_filter:
            query = query.filter(employment_status=status_filter)

        employment_type = request.query_params.get('employmentType')
        if employment_type:
            query = query.filter(employment_type=employment_type)

        designation_uuid = request.query_params.get('designation')
        if designation_uuid:
            try:
                desig = Designation.objects.get(_id=designation_uuid, company_id=company_id, is_deleted=False)
                query = query.filter(designation=desig)
            except Designation.DoesNotExist:
                pass

        employees = query.order_by('first_name', 'last_name')
        return Response([serialize_employee(e) for e in employees])


    def post(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id

        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )

        required_fields = ['first_name', 'phone', 'department_id', 'joining_date']
        for field in required_fields:
            if not request.data.get(field):
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        employee_id = request.data.get('employee_id')
        if not employee_id:
            count = Employee.objects.filter(company_id=company_id, is_deleted=False).count()
            employee_id = f"EMP-{str(count + 1).zfill(3)}"

        if Employee.objects.filter(company_id=company_id, employee_id=employee_id, is_deleted=False).exists():
            return Response(
                {'error': 'Employee ID already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )

        department_uuid = request.data.get('department_id')
        department = None
        if department_uuid:
            department = get_object_or_404(Department, _id=department_uuid, company_id=company_id, is_deleted=False)

        designation_uuid = request.data.get('designation_id')
        designation = None
        if designation_uuid:
            designation = get_object_or_404(Designation, _id=designation_uuid, company_id=company_id, is_deleted=False)

        joining_date = datetime.strptime(request.data['joining_date'], '%Y-%m-%d').date() if request.data.get('joining_date') else None
        date_of_birth = None
        if request.data.get('date_of_birth'):
            date_of_birth = datetime.strptime(request.data['date_of_birth'], '%Y-%m-%d').date()
        confirmation_date = None
        if request.data.get('confirmation_date'):
            confirmation_date = datetime.strptime(request.data['confirmation_date'], '%Y-%m-%d').date()

        reporting_manager_uuid = request.data.get('reporting_manager_id')
        reporting_manager = None
        if reporting_manager_uuid:
            reporting_manager = get_object_or_404(Employee, _id=reporting_manager_uuid, company_id=company_id, is_deleted=False)

        default_shift_uuid = request.data.get('default_shift_id')
        from apps.hr.models import ShiftTemplate
        default_shift = None
        if default_shift_uuid:
            default_shift = get_object_or_404(ShiftTemplate, _id=default_shift_uuid, company_id=company_id, is_deleted=False)

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
            role='STAFF',
            department=department,
            designation=designation,
            employment_type=request.data.get('employment_type', 'FULL_TIME'),
            employment_status=request.data.get('employment_status', 'ACTIVE'),
            joining_date=joining_date,
            confirmation_date=confirmation_date,
            probation_days=request.data.get('probation_days', 180),
            work_location=request.data.get('work_location', 'OFFICE'),
            reporting_manager=reporting_manager,
            default_shift=default_shift,
            bank_name=request.data.get('bank_name'),
            bank_account_number=request.data.get('bank_account_number'),
            bank_iban=request.data.get('bank_iban'),
            salary=request.data.get('salary', 0),
            profile_picture=request.data.get('profile_picture', ''),
            profile_picture_thumb=request.data.get('profile_picture_thumb', ''),
            created_by=request.user,
            updated_by=request.user,
        )

        # Create employee documents from uploaded files
        education_docs = request.data.get('education_documents', [])
        for doc_data in education_docs:
            EmployeeDocument.objects.create(
                company_id=company_id,
                branch_id=branch_id,
                employee=employee,
                document_type='EDUCATION',
                title=doc_data.get('title', ''),
                file_url=doc_data.get('file_url', ''),
                file_url_thumb=doc_data.get('file_url_thumb', ''),
                original_filename=doc_data.get('original_filename', ''),
                file_size=doc_data.get('file_size', 0),
                mime_type=doc_data.get('mime_type', ''),
                sort_order=doc_data.get('sort_order', 0),
                created_by=request.user,
                updated_by=request.user,
            )

        experience_docs = request.data.get('experience_documents', [])
        for doc_data in experience_docs:
            EmployeeDocument.objects.create(
                company_id=company_id,
                branch_id=branch_id,
                employee=employee,
                document_type='EXPERIENCE',
                title=doc_data.get('title', ''),
                file_url=doc_data.get('file_url', ''),
                file_url_thumb=doc_data.get('file_url_thumb', ''),
                original_filename=doc_data.get('original_filename', ''),
                file_size=doc_data.get('file_size', 0),
                mime_type=doc_data.get('mime_type', ''),
                sort_order=doc_data.get('sort_order', 0),
                created_by=request.user,
                updated_by=request.user,
            )

        if default_shift and joining_date:
            EmployeeDefaultShift.objects.create(
                company_id=company_id,
                employee=employee,
                template=default_shift,
                effective_from=joining_date,
                created_by=request.user,
                updated_by=request.user,
            )

        asset_category_uuid = request.data.get('asset_category_id')
        if asset_category_uuid:
            self._assign_assets_from_category(employee, asset_category_uuid, request.user)

        # Link to user: priority — explicit user id passed from frontend, else match by email
        try:
            from apps.organization.models import User
            explicit_user_id = request.data.get('isfrom_user_id')
            user = None
            if explicit_user_id:
                try:
                    user = User.objects.get(_id=explicit_user_id, company_id=company_id, is_deleted=False)
                except User.DoesNotExist:
                    user = None

            if not user and employee.email:
                user = User.objects.filter(email=employee.email, company_id=company_id, is_deleted=False).first()

            if user:
                employee.isfrom_user = user
                employee.save()
                user.isfrom_employee = employee
                user.save()
        except Exception:
            pass

        # Link to recruitment candidate if provided
        candidate_id = request.data.get('candidate_id')
        if candidate_id:
            try:
                candidate = RecruitmentCandidate.objects.get(_id=candidate_id, company_id=company_id, is_deleted=False)
                candidate.converted_employee = employee
                candidate.stage = 'Hired'
                candidate.status = 'Closed'
                candidate.save()
            except RecruitmentCandidate.DoesNotExist:
                pass

        return Response({
            "message": "Employee created successfully",
            "employee": serialize_employee(employee),
        }, status=status.HTTP_201_CREATED)

    def _assign_assets_from_category(self, employee, category_uuid, user):
        try:
            category = AssetCategory.objects.get(_id=category_uuid, company_id=employee.company_id, is_deleted=False)
            assets = list(category.assets.filter(is_deleted=False, is_active=True))
            assignments = []
            for asset in assets:
                assignments.append(EmployeeAssetAssignment(
                    company_id=employee.company_id,
                    branch_id=employee.branch_id,
                    employee=employee,
                    asset=asset,
                    source_type='KIT',
                    source_kit=category,
                    assigned_date=date.today(),
                    status='ACTIVE',
                    condition_on_assignment='NEW',
                    notes=f"Assigned via kit: {category.name}",
                    created_by=user,
                    updated_by=user,
                ))
            if assignments:
                EmployeeAssetAssignment.objects.bulk_create(assignments)
        except AssetCategory.DoesNotExist:
            logger.warning(f"AssetCategory {category_uuid} not found")
        except Exception as e:
            logger.error(f"Error assigning assets from kit: {str(e)}")


    def patch(self, request):
        try:
            company_id = request.user.company_id
            if not company_id:
                return Response(
                    {'error': 'User is not associated with any company'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            employee_uuid = request.data.get('id')
            if not employee_uuid:
                return Response(
                    {'error': 'id (UUID) is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            employee = get_object_or_404(
                Employee,
                _id=employee_uuid,
                company_id=company_id,
                is_deleted=False
            )

            # ---------- Department ----------
            if 'department_id' in request.data:
                value = request.data['department_id']
                if value:
                    employee.department = get_object_or_404(
                        Department, _id=value, company_id=company_id, is_deleted=False
                    )
                else:
                    employee.department = None

            # ---------- Designation ----------
            if 'designation_id' in request.data:
                value = request.data['designation_id']
                if value:
                    employee.designation = get_object_or_404(
                        Designation, _id=value, company_id=company_id, is_deleted=False
                    )
                else:
                    employee.designation = None

            # ---------- Simple string / number fields ----------
            updatable_fields = [
                'first_name', 'last_name', 'father_name', 'cnic',
                'gender', 'marital_status', 'phone', 'email', 'personal_email',
                'address_line', 'country', 'state', 'city', 'postal_code',
                'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
                'employment_type', 'employment_status',
                'work_location', 'bank_name', 'bank_account_number', 'bank_iban',
                'probation_days',
                'profile_picture', 'profile_picture_thumb',
            ]
            for field in updatable_fields:
                if field in request.data:
                    setattr(employee, field, request.data[field])

            # ---------- Handle education/experience documents (relational) ----------
            if 'education_documents' in request.data:
                # Soft-delete existing education docs
                employee.documents.filter(document_type='EDUCATION', is_deleted=False).update(is_deleted=True)
                # Create new ones
                for doc_data in request.data['education_documents']:
                    EmployeeDocument.objects.create(
                        company_id=company_id,
                        branch_id=employee.branch_id,
                        employee=employee,
                        document_type='EDUCATION',
                        title=doc_data.get('title', ''),
                        file_url=doc_data.get('file_url', ''),
                        file_url_thumb=doc_data.get('file_url_thumb', ''),
                        original_filename=doc_data.get('original_filename', ''),
                        file_size=doc_data.get('file_size', 0),
                        mime_type=doc_data.get('mime_type', ''),
                        sort_order=doc_data.get('sort_order', 0),
                        created_by=request.user,
                        updated_by=request.user,
                    )

            if 'experience_documents' in request.data:
                # Soft-delete existing experience docs
                employee.documents.filter(document_type='EXPERIENCE', is_deleted=False).update(is_deleted=True)
                # Create new ones
                for doc_data in request.data['experience_documents']:
                    EmployeeDocument.objects.create(
                        company_id=company_id,
                        branch_id=employee.branch_id,
                        employee=employee,
                        document_type='EXPERIENCE',
                        title=doc_data.get('title', ''),
                        file_url=doc_data.get('file_url', ''),
                        file_url_thumb=doc_data.get('file_url_thumb', ''),
                        original_filename=doc_data.get('original_filename', ''),
                        file_size=doc_data.get('file_size', 0),
                        mime_type=doc_data.get('mime_type', ''),
                        sort_order=doc_data.get('sort_order', 0),
                        created_by=request.user,
                        updated_by=request.user,
                    )

            # ---------- Salary (Decimal) ----------
            if 'salary' in request.data:
                try:
                    employee.salary = request.data['salary']
                except Exception as e:
                    logger.warning(f"Invalid salary value: {request.data['salary']} - {e}")

            # ---------- Reporting Manager ----------
            if 'reporting_manager_id' in request.data:
                value = request.data['reporting_manager_id']
                if value:
                    employee.reporting_manager = get_object_or_404(
                        Employee, _id=value, company_id=company_id, is_deleted=False
                    )
                else:
                    employee.reporting_manager = None

            # ---------- Default Shift ----------
            if 'default_shift_id' in request.data:
                value = request.data['default_shift_id']
                from apps.hr.models import ShiftTemplate
                if value:
                    new_template = get_object_or_404(
                        ShiftTemplate, _id=value, company_id=company_id, is_deleted=False
                    )
                    employee.default_shift = new_template

                    today = date.today()

                    # Close out any currently active EmployeeDefaultShift record
                    EmployeeDefaultShift.objects.filter(
                        employee=employee,
                        effective_to__isnull=True,
                        is_deleted=False,
                    ).update(effective_to=today)

                    # Create new history record
                    EmployeeDefaultShift.objects.create(
                        company_id=company_id,
                        branch_id=employee.branch_id,
                        employee=employee,
                        template=new_template,
                        effective_from=today,
                        created_by=request.user,
                        updated_by=request.user,
                    )
                else:
                    employee.default_shift = None

                    # Close out any active default shift record
                    EmployeeDefaultShift.objects.filter(
                        employee=employee,
                        effective_to__isnull=True,
                        is_deleted=False,
                    ).update(effective_to=date.today())

            # ---------- Date fields (handle empty string / None) ----------
            if 'date_of_birth' in request.data:
                val = request.data['date_of_birth']
                employee.date_of_birth = datetime.strptime(val, '%Y-%m-%d').date() if val else None

            if 'joining_date' in request.data:
                val = request.data['joining_date']
                employee.joining_date = datetime.strptime(val, '%Y-%m-%d').date() if val else None

            if 'confirmation_date' in request.data:
                val = request.data['confirmation_date']
                employee.confirmation_date = datetime.strptime(val, '%Y-%m-%d').date() if val else None

            # ---------- Link to User (if provided) ----------
            try:
                explicit_user_id = request.data.get('isfrom_user_id')
                if explicit_user_id:
                    from apps.organization.models import User
                    try:
                        user = User.objects.get(_id=explicit_user_id, company_id=company_id, is_deleted=False)
                        employee.isfrom_user = user
                        user.isfrom_employee = employee
                        user.save()
                    except User.DoesNotExist:
                        logger.warning(f"User with _id {explicit_user_id} not found for employee update")
            except Exception as e:
                logger.error(f"Error linking user: {e}")

            employee.updated_by = request.user
            employee.save()

            return Response({
                "message": "Employee updated successfully",
                "employee": serialize_employee(employee),
            })

        except Exception as e:
            logger.error(f"Employee PATCH error: {str(e)}\n{traceback.format_exc()}")
            return Response(
                {'error': f'Internal server error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    

    def delete(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )

        employee_uuid = request.data.get('id')
        if not employee_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        employee = get_object_or_404(
            Employee,
            _id=employee_uuid,
            company_id=company_id,
            is_deleted=False
        )

        active_assignments = employee.asset_assignments.filter(status='ACTIVE')
        if active_assignments.exists():
            return Response(
                {'error': 'Cannot delete employee with active asset assignments. Please return assets first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        employee.is_deleted = True
        employee.deleted_at = timezone.now()
        employee.deleted_by = request.user
        employee.save()
        return Response({'message': 'Employee deleted successfully'})


class EmployeeStatsView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'employee'
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )

        employees = Employee.objects.filter(company_id=company_id, is_deleted=False)
        dept_counts = list(employees.values('department__name').annotate(count=models.Count('id')).order_by('-count'))
        status_counts = list(employees.values('employment_status').annotate(count=models.Count('id')))

        return Response({
            "totalEmployees": employees.count(),
            "activeEmployees": employees.filter(employment_status='ACTIVE').count(),
            "onLeave": employees.filter(employment_status='ON_LEAVE').count(),
            "departments": employees.values('department__name').distinct().count(),
            "withDefaultShift": employees.filter(default_shift__isnull=False).count(),
            "byDepartment": dept_counts,
            "byStatus": status_counts,
        })


class ActiveEmployeesView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'employee'
    permission_classes = [IsAuthenticated]
    action_permission_any_of = {
        "": [("INVENTORY", "warehouse"), ("INVENTORY", "purchase_order")],
    }

    def get(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )

        employees = Employee.objects.filter(
            company_id=company_id,
            is_deleted=False,
            employment_status='ACTIVE'
        ).select_related('default_shift', 'reporting_manager', 'department', 'designation')

        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            employees = employees.filter(
                models.Q(branch_id=request.user.branch_id) | models.Q(branch_id__isnull=True)
            )

        data = [serialize_employee(emp) for emp in employees]

        return Response(data)