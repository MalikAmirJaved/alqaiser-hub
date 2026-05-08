import logging
from datetime import datetime
from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from datetime import datetime, time 

from apps.compsetting.models import (
    CompanySettings, WorkingDay, PublicHoliday, 
    LeaveType, CompanySettingHistory, Designation
)
from apps.organization.models import Company, Branch

logger = logging.getLogger(__name__)


class BaseCompanyView(APIView):
    """Base view with common methods"""
    permission_classes = [IsAuthenticated]
    
    def _get_company(self, user):
        """Get company with error handling"""
        if not user.company_id:
            raise ValueError("User is not associated with any company")
        return get_object_or_404(Company, id=user.company_id, is_deleted=False)
    
    def _get_settings(self, user):
        """Get or create settings for user's company"""
        company = self._get_company(user)
        settings, _ = CompanySettings.objects.get_or_create(
            company=company,
            defaults={
                'currency': 'USD',
                'timezone': 'UTC',
                'created_by': user,
                'updated_by': user,
            }
        )
        return company, settings
    
    def _log_change(self, settings, company, field_name, old_value, new_value, user):
        """Log settings changes to history"""
        CompanySettingHistory.objects.create(
            settings=settings,
            company=company,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            changed_by=user,
        )


class CompanySettingsView(BaseCompanyView):
    """Main company settings CRUD"""
    
    def _get_or_create_settings(self, company, user):
        """Get or create settings with defaults"""
        settings, created = CompanySettings.objects.get_or_create(
            company=company,
            defaults={
                "currency": "USD",
                "timezone": "UTC",
                "created_by": user,
                "updated_by": user,
            }
        )
        
        if created:
            self._create_default_working_days(settings, company, user)
            self._create_default_leave_types(settings, company, user)
        
        return settings
    
    def _create_default_working_days(self, settings, company, user):
        """Create default working days"""
        default_days = [
            {"day": 0, "is_working": True, "start_time": "09:00", "end_time": "18:00"},
            {"day": 1, "is_working": True, "start_time": "09:00", "end_time": "18:00"},
            {"day": 2, "is_working": True, "start_time": "09:00", "end_time": "18:00"},
            {"day": 3, "is_working": True, "start_time": "09:00", "end_time": "18:00"},
            {"day": 4, "is_working": True, "start_time": "09:00", "end_time": "18:00"},
            {"day": 5, "is_working": False, "start_time": "09:00", "end_time": "18:00"},
            {"day": 6, "is_working": False, "start_time": "09:00", "end_time": "18:00"},
        ]
        
        for day_config in default_days:
            WorkingDay.objects.create(
                settings=settings,
                company=company,
                created_by=user,
                updated_by=user,
                **day_config
            )
    
    def _create_default_leave_types(self, settings, company, user):
        """Create default leave types"""
        defaults = [
            {
                "name": "Casual Leave",
                "code": "CASUAL",
                "default_days_per_year": 12,
                "order": 1,
                "color_code": "#4A90E2"
            },
            {
                "name": "Sick Leave",
                "code": "SICK",
                "default_days_per_year": 12,
                "requires_document": True,
                "order": 2,
                "color_code": "#E24A4A"
            },
            {
                "name": "Annual Leave",
                "code": "ANNUAL",
                "default_days_per_year": 21,
                "max_carry_forward_days": 5,
                "order": 3,
                "color_code": "#4AE24A"
            },
            {
                "name": "Maternity Leave",
                "code": "MATERNITY",
                "default_days_per_year": 90,
                "gender_specific": "FEMALE",
                "applicable_after_months": 6,
                "order": 4,
                "color_code": "#E24AE2"
            },
        ]
        
        for lt_config in defaults:
            LeaveType.objects.create(
                settings=settings,
                company=company,
                created_by=user,
                updated_by=user,
                **lt_config
            )

    def _serialize_settings(self, company, settings):
        """Full serialization including related models"""
        # Optimize queries with prefetch_related
        settings = CompanySettings.objects.prefetch_related(
            Prefetch('working_days', queryset=WorkingDay.objects.filter(is_deleted=False)),
            Prefetch('leave_types', queryset=LeaveType.objects.filter(is_deleted=False, is_active=True)),
            Prefetch('public_holidays', queryset=PublicHoliday.objects.filter(is_deleted=False)),
        ).get(id=settings.id)
        
        return {
            # Company Details
            "companyId": company.id,
            "companyName": company.name,
            "companyShortName": company.short_name,
            "address": company.address,
            "city": company.city,
            "country": company.country,
            "phone": company.phone,
            "email": company.email,
            
            # Financial Settings
            "currency": settings.currency,
            "taxRate": str(settings.tax_rate),
            "taxId": settings.tax_id or company.tax_id,
            
            # Time Settings
            "timezone": settings.timezone,
            
            # Working Hours
            "defaultStartTime": settings.default_start_time.strftime("%H:%M"),
            "defaultEndTime": settings.default_end_time.strftime("%H:%M"),
            "workingHoursPerDay": str(settings.working_hours_per_day),
            
            # Leave Policies
            "leaveDuringProbation": settings.leave_during_probation,
            "allowCarryForward": settings.allow_carry_forward,
            "maxCarryForwardDays": settings.max_carry_forward_days,
            
            # Status
            "isSetupCompleted": settings.is_setup_completed,
            
            # Working Days
            "workingDays": [
                {
                    "id": wd.id,
                    "day": wd.day,
                    "label": wd.get_day_display(),
                    "isWorking": wd.is_working,
                    "startTime": wd.start_time.strftime("%H:%M") if wd.start_time else None,
                    "endTime": wd.end_time.strftime("%H:%M") if wd.end_time else None,
                    "isHalfDay": wd.is_half_day,
                }
                for wd in settings.working_days.all()
            ],
            
            # Leave Types
            "leaveTypes": [
                {
                    "id": lt.id,
                    "name": lt.name,
                    "code": lt.code,
                    "description": lt.description,
                    "isPaid": lt.is_paid,
                    "defaultDaysPerYear": lt.default_days_per_year,
                    "maxCarryForwardDays": lt.max_carry_forward_days,
                    "minDaysPerRequest": lt.min_days_per_request,
                    "maxDaysPerRequest": lt.max_days_per_request,
                    "requiresApproval": lt.requires_approval,
                    "requiresDocument": lt.requires_document,
                    "isActive": lt.is_active,
                    "applicableAfterMonths": lt.applicable_after_months,
                    "genderSpecific": lt.gender_specific,
                    "colorCode": lt.color_code,
                    "order": lt.order,
                }
                for lt in settings.leave_types.all()
            ],
            
            # Public Holidays (current year)
            "publicHolidays": [
                {
                    "id": ph.id,
                    "name": ph.name,
                    "date": ph.date.isoformat(),
                    "endDate": ph.end_date.isoformat() if ph.end_date else None,
                    "isRecurringYearly": ph.is_recurring_yearly,
                    "isHalfDay": ph.is_half_day,
                    "description": ph.description,
                    "holidayType": ph.holiday_type,
                }
                for ph in settings.public_holidays.all()
            ],
        }

    def get(self, request):
        """Get full company settings"""
        company, settings = self._get_settings(request.user)
        return Response(self._serialize_settings(company, settings))

    @transaction.atomic
    def patch(self, request):
        """Update settings and company details"""
        company, settings = self._get_settings(request.user)
        user = request.user
        
        # Update Company fields
        company_fields = {
            'companyName': 'name',
            'address': 'address',
            'city': 'city',
            'country': 'country',
            'phone': 'phone',
            'email': 'email',
            'taxId': 'tax_id',
        }
        
        for request_field, model_field in company_fields.items():
            if request_field in request.data:
                old_value = getattr(company, model_field)
                new_value = request.data[request_field]
                
                if old_value != new_value:
                    setattr(company, model_field, new_value)
                    self._log_change(
                        settings, company, f"company.{model_field}",
                        old_value, new_value, user
                    )
        
        company.save()
        
        # Update Settings fields
        settings_fields = {
            'currency': 'currency',
            'taxRate': 'tax_rate',
            'timezone': 'timezone',
            'defaultStartTime': 'default_start_time',
            'defaultEndTime': 'default_end_time',
            'workingHoursPerDay': 'working_hours_per_day',
            'leaveDuringProbation': 'leave_during_probation',
            'allowCarryForward': 'allow_carry_forward',
            'maxCarryForwardDays': 'max_carry_forward_days',
        }
        
        for request_field, model_field in settings_fields.items():
            if request_field in request.data:
                old_value = getattr(settings, model_field)
                new_value = request.data[request_field]
                
                # Convert string to proper type for comparison
                if model_field == 'tax_rate':
                    new_value = float(new_value) if new_value else 0.0
                elif model_field == 'working_hours_per_day':
                    new_value = float(new_value) if new_value else 8.0
                elif model_field =='max_carry_forward_days':
                    new_value = int(new_value) if new_value else 0
                
                if str(old_value) != str(new_value):
                    setattr(settings, model_field, new_value)
                    self._log_change(
                        settings, company, f"settings.{model_field}",
                        old_value, new_value, user
                    )
        
        # Auto-mark setup completed
        if settings.currency and not settings.is_setup_completed:
            settings.is_setup_completed = True
        
        settings.updated_by = user
        settings.save()
        
        return Response(self._serialize_settings(company, settings))


class WorkingDaysView(BaseCompanyView):
    """Manage working days"""
    
    @transaction.atomic
    def patch(self, request):
        """Update working days configuration"""
        company, settings = self._get_settings(request.user)
        user = request.user
        working_days_data = request.data.get('workingDays', [])
                
        if not working_days_data:
            return Response(
                {'error': 'workingDays is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_count = 0
        created_count = 0
        
        for day_data in working_days_data:
            try:
                # Try to get existing working day, or create if doesn't exist
                working_day, created = WorkingDay.objects.get_or_create(
                    settings=settings,
                    day=day_data['day'],
                    defaults={
                        'company': company,
                        'is_working': day_data.get('isWorking', True),
                        'start_time': '09:00',
                        'end_time': '18:00',
                        'created_by': user,
                        'updated_by': user,
                    }
                )
                
                if created:
                    created_count += 1
                    # Set initial values for newly created record
                    working_day.is_working = day_data.get('isWorking', True)
                    working_day.save()
                    continue
                
                # Update existing record
                changes_made = False
                
                if 'isWorking' in day_data:
                    if working_day.is_working != day_data['isWorking']:
                        working_day.is_working = day_data['isWorking']
                        changes_made = True
                
                if 'startTime' in day_data and day_data['startTime']:
                    try:
                        hours, minutes = map(int, day_data['startTime'].split(':'))
                        new_time = time(hours, minutes)
                        if working_day.start_time != new_time:
                            working_day.start_time = new_time
                            changes_made = True
                    except (ValueError, TypeError) as e:
                        logger.error(f"Invalid start time format: {day_data['startTime']}")
                
                if 'endTime' in day_data and day_data['endTime']:
                    try:
                        hours, minutes = map(int, day_data['endTime'].split(':'))
                        new_time = time(hours, minutes)
                        if working_day.end_time != new_time:
                            working_day.end_time = new_time
                            changes_made = True
                    except (ValueError, TypeError) as e:
                        logger.error(f"Invalid end time format: {day_data['endTime']}")
                
                if 'isHalfDay' in day_data:
                    if working_day.is_half_day != day_data['isHalfDay']:
                        working_day.is_half_day = day_data['isHalfDay']
                        changes_made = True
                
                if changes_made:
                    working_day.updated_by = user
                    working_day.save()
                    updated_count += 1
                    
            except Exception as e:
                logger.error(f"Error processing working day {day_data.get('day')}: {e}", exc_info=True)
                continue

        return Response({
            'message': f'{updated_count} working days updated, {created_count} created',
            'updatedCount': updated_count,
            'createdCount': created_count
        })
    
class LeaveTypesView(BaseCompanyView):
    """CRUD for leave types"""
    
    def get(self, request):
        """Get all leave types"""
        _, settings = self._get_settings(request.user)
        leave_types = LeaveType.objects.filter(
            settings=settings,
            is_deleted=False
        )
        
        return Response([
            {
                "id": lt.id,
                "name": lt.name,
                "code": lt.code,
                "description": lt.description,
                "isPaid": lt.is_paid,
                "defaultDaysPerYear": lt.default_days_per_year,
                "maxCarryForwardDays": lt.max_carry_forward_days,
                "minDaysPerRequest": lt.min_days_per_request,
                "maxDaysPerRequest": lt.max_days_per_request,
                "requiresApproval": lt.requires_approval,
                "requiresDocument": lt.requires_document,
                "isActive": lt.is_active,
                "applicableAfterMonths": lt.applicable_after_months,
                "genderSpecific": lt.gender_specific,
                "colorCode": lt.color_code,
                "order": lt.order,
            }
            for lt in leave_types
        ])

    @transaction.atomic
    def post(self, request):
        """Create new leave type"""
        company, settings = self._get_settings(request.user)
        
        required_fields = ['name', 'code']
        for field in required_fields:
            if field not in request.data:
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Check for duplicate code
        if LeaveType.objects.filter(
            settings=settings,
            code=request.data['code'].upper(),
            is_deleted=False
        ).exists():
            return Response(
                {'error': 'Leave type with this code already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_type = LeaveType.objects.create(
            settings=settings,
            company=company,
            name=request.data['name'],
            code=request.data['code'].upper(),
            description=request.data.get('description', ''),
            is_paid=request.data.get('isPaid', True),
            default_days_per_year=request.data.get('defaultDaysPerYear', 0),
            max_carry_forward_days=request.data.get('maxCarryForwardDays', 0),
            min_days_per_request=request.data.get('minDaysPerRequest', 1),
            max_days_per_request=request.data.get('maxDaysPerRequest', 30),
            requires_approval=request.data.get('requiresApproval', True),
            requires_document=request.data.get('requiresDocument', False),
            applicable_after_months=request.data.get('applicableAfterMonths', 0),
            gender_specific=request.data.get('genderSpecific', 'ALL'),
            color_code=request.data.get('colorCode', '#4A90E2'),
            order=request.data.get('order', 0),
            created_by=request.user,
            updated_by=request.user,
        )

        return Response({
            "id": leave_type.id,
            "name": leave_type.name,
            "code": leave_type.code,
            "isPaid": leave_type.is_paid,
            "defaultDaysPerYear": leave_type.default_days_per_year,
        }, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def patch(self, request):
        """Update leave type"""
        _, settings = self._get_settings(request.user)
        leave_type_id = request.data.get('id')

        if not leave_type_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_type = get_object_or_404(
            LeaveType,
            id=leave_type_id,
            settings=settings,
            is_deleted=False
        )

        updatable_fields = {
            'name': 'name',
            'description': 'description',
            'isPaid': 'is_paid',
            'defaultDaysPerYear': 'default_days_per_year',
            'maxCarryForwardDays': 'max_carry_forward_days',
            'minDaysPerRequest': 'min_days_per_request',
            'maxDaysPerRequest': 'max_days_per_request',
            'requiresApproval': 'requires_approval',
            'requiresDocument': 'requires_document',
            'isActive': 'is_active',
            'applicableAfterMonths': 'applicable_after_months',
            'genderSpecific': 'gender_specific',
            'colorCode': 'color_code',
            'order': 'order',
        }

        for request_field, model_field in updatable_fields.items():
            if request_field in request.data:
                setattr(leave_type, model_field, request.data[request_field])

        leave_type.updated_by = request.user
        leave_type.save()

        return Response({
            'message': 'Leave type updated successfully',
            'id': leave_type.id
        })

    @transaction.atomic
    def delete(self, request):
        """Soft delete leave type"""
        _, settings = self._get_settings(request.user)
        leave_type_id = request.data.get('id')

        if not leave_type_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_type = get_object_or_404(
            LeaveType,
            id=leave_type_id,
            settings=settings,
            is_deleted=False
        )

        leave_type.is_deleted = True
        leave_type.deleted_at = datetime.now()
        leave_type.deleted_by = request.user
        leave_type.save()

        return Response({'message': 'Leave type deleted successfully'})


class PublicHolidaysView(BaseCompanyView):
    """CRUD for public holidays"""
    
    def get(self, request):
        """Get public holidays with optional year filter"""
        _, settings = self._get_settings(request.user)
        year = request.query_params.get('year')
        
        query = PublicHoliday.objects.filter(
            settings=settings,
            is_deleted=False
        )
        if year:
            query = query.filter(date__year=year)
        
        return Response([
            {
                "id": ph.id,
                "name": ph.name,
                "date": ph.date.isoformat(),
                "endDate": ph.end_date.isoformat() if ph.end_date else None,
                "isRecurringYearly": ph.is_recurring_yearly,
                "isHalfDay": ph.is_half_day,
                "description": ph.description,
                "holidayType": ph.holiday_type,
            }
            for ph in query
        ])

    @transaction.atomic
    def post(self, request):
        """Add public holiday(s) - supports bulk create"""
        company, settings = self._get_settings(request.user)
        
        # Handle both single and bulk create
        holidays_data = request.data if isinstance(request.data, list) else [request.data]
        
        created = []
        errors = []
        
        for idx, holiday_data in enumerate(holidays_data):
            try:
                required_fields = ['name', 'date']
                for field in required_fields:
                    if field not in holiday_data:
                        raise ValueError(f'{field} is required for holiday {idx + 1}')

                holiday = PublicHoliday.objects.create(
                    settings=settings,
                    company=company,
                    name=holiday_data['name'],
                    date=holiday_data['date'],
                    end_date=holiday_data.get('endDate'),
                    is_recurring_yearly=holiday_data.get('isRecurringYearly', False),
                    is_half_day=holiday_data.get('isHalfDay', False),
                    description=holiday_data.get('description', ''),
                    holiday_type=holiday_data.get('holidayType', 'NATIONAL'),
                    created_by=request.user,
                    updated_by=request.user,
                )
                created.append({
                    "id": holiday.id,
                    "name": holiday.name,
                    "date": holiday.date.isoformat(),
                })
            except Exception as e:
                errors.append(str(e))

        return Response({
            'created': created,
            'errors': errors if errors else None,
            'count': len(created)
        }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)

    @transaction.atomic
    def delete(self, request, holiday_id):
        """Soft delete public holiday"""
        _, settings = self._get_settings(request.user)
        holiday = get_object_or_404(
            PublicHoliday,
            id=holiday_id,
            settings=settings,
            is_deleted=False
        )
        
        holiday.is_deleted = True
        holiday.deleted_at = datetime.now()
        holiday.deleted_by = request.user
        holiday.save()
        
        return Response({'message': 'Holiday removed successfully'})


class SettingHistoryView(BaseCompanyView):
    """View settings change history"""
    
    def get(self, request):
        """Get paginated settings history"""
        company, settings = self._get_settings(request.user)
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('pageSize', 20))
        
        query = CompanySettingHistory.objects.filter(
            settings=settings
        ).select_related('changed_by')
        
        total = query.count()
        history = query[(page - 1) * page_size:page * page_size]
        
        return Response({
            'data': [
                {
                    'id': h.id,
                    'fieldName': h.field_name,
                    'oldValue': h.old_value,
                    'newValue': h.new_value,
                    'changedBy': h.changed_by.get_full_name() if h.changed_by else 'System',
                    'changedAt': h.created_at.isoformat(),
                }
                for h in history
            ],
            'total': total,
            'page': page,
            'pageSize': page_size,
        })
    

class DesignationView(BaseCompanyView):
    """CRUD for company designations"""

    def get(self, request):
        """Get all designations"""

        company, settings = self._get_settings(request.user)

        designations = Designation.objects.filter(
            settings=settings,
            is_deleted=False
        ).order_by('id', 'name')

        return Response([
            {
                "id": d.id,
                "_id": str(d._id),
                "name": d.name,
                "department": d.department,
                "payGrade": d.pay_grade,
                "description": d.description,
                "isActive": d.is_active,
                "createdAt": d.created_at.isoformat(),
                "updatedAt": d.updated_at.isoformat(),
            }
            for d in designations
        ])

    @transaction.atomic
    def post(self, request):
        """Create designation"""

        company, settings = self._get_settings(request.user)

        required_fields = ['name']

        for field in required_fields:
            if field not in request.data:
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Prevent duplicate designation names
        if Designation.objects.filter(
            company=company,
            name=request.data['name'],
            is_deleted=False
        ).exists():
            return Response(
                {'error': 'Designation already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )

        designation = Designation.objects.create(
            settings=settings,
            company=company,
            branch_id=request.data.get('branchId'),

            name=request.data.get('name'),
            department=request.data.get('department'),
            pay_grade=request.data.get('payGrade'),
            description=request.data.get('description'),

            is_active=request.data.get('isActive', True),

            created_by=request.user,
            updated_by=request.user,
        )

        return Response({
            "message": "Designation created successfully",
            "id": designation.id,
            "name": designation.name,
        }, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def patch(self, request):
        """Update designation"""

        company, settings = self._get_settings(request.user)

        designation_id = request.data.get('id')

        if not designation_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        designation = get_object_or_404(
            Designation,
            id=designation_id,
            settings=settings,
            is_deleted=False
        )

        updatable_fields = {
            'name': 'name',
            'department': 'department',
            'payGrade': 'pay_grade',
            'description': 'description',
            'isActive': 'is_active',
        }

        for request_field, model_field in updatable_fields.items():
            if request_field in request.data:
                setattr(
                    designation,
                    model_field,
                    request.data[request_field]
                )

        # Update branch if provided
        if 'branchId' in request.data:
            designation.branch_id = request.data.get('branchId')

        designation.updated_by = request.user
        designation.save()

        return Response({
            "message": "Designation updated successfully",
            "id": designation.id
        })

    @transaction.atomic
    def delete(self, request):
        """Soft delete designation"""

        _, settings = self._get_settings(request.user)

        designation_id = request.data.get('id')

        if not designation_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        designation = get_object_or_404(
            Designation,
            id=designation_id,
            settings=settings,
            is_deleted=False
        )

        designation.is_deleted = True
        designation.deleted_at = datetime.now()
        designation.deleted_by = request.user
        designation.save()

        return Response({
            'message': 'Designation deleted successfully'
        })
    
class WelcomeDesignationSetupView(BaseCompanyView):
    """Dedicated bulk create for initial company setup wizard"""
    
    @transaction.atomic
    def post(self, request):
        """Bulk create designations during welcome/setup"""
        company, settings = self._get_settings(request.user)
        user = request.user
        
        designations_data = request.data.get('designations', [])
        
        if not designations_data or not isinstance(designations_data, list):
            return Response(
                {'error': 'designations list is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(designations_data) == 0:
            return Response(
                {'error': 'At least one designation is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        created = []
        errors = []

        for idx, des_data in enumerate(designations_data):
            try:
                name = des_data.get('name', '').strip()
                if not name:
                    raise ValueError(f"Designation name is required at index {idx}")

                # Prevent duplicates in this batch + existing
                if Designation.objects.filter(
                    company=company, 
                    name__iexact=name, 
                    is_deleted=False
                ).exists():
                    raise ValueError(f"Designation '{name}' already exists")

                designation = Designation.objects.create(
                    settings=settings,
                    company=company,
                    branch_id=des_data.get('branchId'),
                    name=name,
                    department=des_data.get('department'),
                    pay_grade=des_data.get('payGrade'),
                    description=des_data.get('description'),
                    is_active=des_data.get('isActive', True),
                    created_by=user,
                    updated_by=user,
                )
                
                created.append({
                    "id": designation.id,
                    "_id": str(designation._id),
                    "name": designation.name,
                })
                
            except Exception as e:
                errors.append({
                    "index": idx,
                    "data": des_data,
                    "error": str(e)
                })

        return Response({
            'message': f'Successfully created {len(created)} designation(s)',
            'created': created,
            'errors': errors if errors else None,
            'count': len(created)
        }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)