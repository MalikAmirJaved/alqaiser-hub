import logging
from datetime import datetime
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from datetime import datetime, time

from apps.permissions.mixins import PermissionRequiredMixin
from apps.compsetting.models import (
    CompanySettings, WorkingDay, PublicHoliday,
    CompanySettingHistory, Designation
)
from apps.organization.models import Company
from apps.hr.models import Employee
from rest_framework import viewsets
from rest_framework.decorators import action
from .serializers import DesignationSerializer

logger = logging.getLogger(__name__)


class BaseCompanyView(PermissionRequiredMixin, APIView):
    """Base view with common methods"""
    permission_classes = [IsAuthenticated]
    permission_module = 'SETTINGS'

    def _get_company(self, user):
        """Get company with error handling"""
        if not user.company_id:
            raise ValueError("User is not associated with any company")
        return get_object_or_404(Company, id=user.company_id, is_deleted=False)

    def _get_settings(self, user):
        """Get or create settings for user's company - auto-create company if missing"""
        company = None
        
        # If user has company, use it
        if user.company_id:
            company = get_object_or_404(Company, id=user.company_id, is_deleted=False)
        else:
            if self.request.method == 'GET':
                raise ValueError("User not associated with any company")
            return None, None
        
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
    permission_resource = 'company'

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

    def _serialize_settings(self, company, settings):
        """Full serialization including related models"""
        settings = CompanySettings.objects.prefetch_related(
            Prefetch('working_days', queryset=WorkingDay.objects.filter(is_deleted=False)),
            Prefetch('public_holidays', queryset=PublicHoliday.objects.filter(is_deleted=False)),
        ).get(id=settings.id)

        return {
            "companyId": company.id,
            "companyName": company.name,
            "companyShortName": company.short_name,
            "address": company.address,
            "city": company.city,
            "state": company.state,
            "country": company.country,
            "phone": company.phone,
            "email": company.email,
            "currency": settings.currency,
            "taxRate": str(settings.tax_rate),
            "taxId": settings.tax_id or company.tax_id,
            "timezone": settings.timezone,
            "defaultStartTime": settings.default_start_time.strftime("%H:%M"),
            "defaultEndTime": settings.default_end_time.strftime("%H:%M"),
            "workingHoursPerDay": str(settings.working_hours_per_day),
            "workingDays": [
                {
                    "id": str(wd._id),
                    "day": wd.day,
                    "label": wd.get_day_display(),
                    "isWorking": wd.is_working,
                    "startTime": wd.start_time.strftime("%H:%M") if wd.start_time else None,
                    "endTime": wd.end_time.strftime("%H:%M") if wd.end_time else None,
                    "isHalfDay": wd.is_half_day,
                }
                for wd in settings.working_days.all()
            ],
            "publicHolidays": [
                {
                    "id": str(ph._id),
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
        company, settings = self._get_settings(request.user)
        return Response(self._serialize_settings(company, settings))

    def patch(self, request):
        company, settings = self._get_settings(request.user)
        user = request.user

        company_fields = {
            'companyName': 'name',
            'address': 'address',
            'city': 'city',
            'state': 'state',
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

        settings_fields = {
            'currency': 'currency',
            'taxRate': 'tax_rate',
            'timezone': 'timezone',
            'defaultStartTime': 'default_start_time',
            'defaultEndTime': 'default_end_time',
            'workingHoursPerDay': 'working_hours_per_day',
        }

        for request_field, model_field in settings_fields.items():
            if request_field in request.data:
                old_value = getattr(settings, model_field)
                new_value = request.data[request_field]

                if model_field == 'tax_rate':
                    new_value = float(new_value) if new_value else 0.0
                elif model_field == 'working_hours_per_day':
                    new_value = float(new_value) if new_value else 8.0

                if str(old_value) != str(new_value):
                    setattr(settings, model_field, new_value)
                    self._log_change(
                        settings, company, f"settings.{model_field}",
                        old_value, new_value, user
                    )

        settings.updated_by = user
        settings.save()

        return Response(self._serialize_settings(company, settings))


class WorkingDaysView(BaseCompanyView):
    permission_resource = 'preference'

    def patch(self, request):
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
                working_day, created = WorkingDay.objects.get_or_create(
                    company_settings=settings,  # ✅ Changed from 'settings' to 'company_settings'
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
                    working_day.is_working = day_data.get('isWorking', True)
                    working_day.save()
                    continue

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
                    except (ValueError, TypeError):
                        logger.error(f"Invalid start time format: {day_data['startTime']}")

                if 'endTime' in day_data and day_data['endTime']:
                    try:
                        hours, minutes = map(int, day_data['endTime'].split(':'))
                        new_time = time(hours, minutes)
                        if working_day.end_time != new_time:
                            working_day.end_time = new_time
                            changes_made = True
                    except (ValueError, TypeError):
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


class PublicHolidaysView(BaseCompanyView):
    permission_resource = 'preference'

    def get(self, request):
        _, settings = self._get_settings(request.user)
        year = request.query_params.get('year')

        query = PublicHoliday.objects.filter(
            company_settings=settings,  # ✅ Changed
            is_deleted=False
        )
        if year:
            query = query.filter(date__year=year)

        return Response([...])

    def post(self, request):
        company, settings = self._get_settings(request.user)
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
                    company_settings=settings,  # ✅ Changed
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
                    "id": str(holiday._id),
                    "name": holiday.name,
                    "date": holiday.date.isoformat(),
                })
            except Exception as e:
                errors.append(str(e))

        return Response({...})

    def delete(self, request, holiday_id=None):
        _, settings = self._get_settings(request.user)

        if not holiday_id:
            return Response(
                {'error': 'holiday_id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        holiday = get_object_or_404(
            PublicHoliday,
            _id=holiday_id,
            company_settings=settings,  # ✅ Changed
            is_deleted=False
        )

        holiday.is_deleted = True
        holiday.deleted_at = datetime.now()
        holiday.deleted_by = request.user
        holiday.save()

        return Response({'message': 'Holiday removed successfully'})

class SettingHistoryView(BaseCompanyView):
    permission_resource = 'company'

    def get(self, request):
        company, settings = self._get_settings(request.user)
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('pageSize', 20))

        query = CompanySettingHistory.objects.filter(
            company_settings=settings  # ✅ Changed
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


class DesignationViewSet(BaseCompanyView, viewsets.ModelViewSet):
    permission_resource = 'designation'
    serializer_class = DesignationSerializer
    lookup_field = '_id'
    
    def get_queryset(self):
        company, settings = self._get_settings(self.request.user)
        return Designation.objects.filter(company_settings=settings, is_deleted=False)  # ✅ Changed
    
    def perform_create(self, serializer):
        company, settings = self._get_settings(self.request.user)
        serializer.save(
            company_settings=settings,  # ✅ Changed from 'settings' to 'company_settings'
            company=company,
            branch_id=self.request.user.branch_id,
            created_by=self.request.user,
            updated_by=self.request.user,
        )
    
    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['get'], url_path='employees')
    def employees(self, request, _id=None):
        designation = self.get_object()
        employees = Employee.objects.filter(
            company_id=request.user.company_id,
            designation=designation,
            is_deleted=False,
            employment_status='ACTIVE'
        ).values('_id', 'first_name', 'last_name', 'employee_id', 'department')
        return Response(list(employees))

class WelcomeDesignationSetupView(BaseCompanyView):
    permission_resource = 'designation'

    def get_permission_action(self):
        if self.request.method.upper() == 'POST':
            return 'create'
        return super().get_permission_action()

    def post(self, request):
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

                if Designation.objects.filter(
                    company=company,
                    name__iexact=name,
                    is_deleted=False
                ).exists():
                    raise ValueError(f"Designation '{name}' already exists")

                # Resolve department UUID to Department instance; 'ALL' or missing -> None
                dept_uuid = des_data.get('department')
                dept_obj = None
                if dept_uuid and str(dept_uuid).upper() != 'ALL':
                    from apps.organization.models import Department as DeptModel
                    try:
                        dept_obj = DeptModel.objects.get(_id=dept_uuid, company=company, is_deleted=False)
                    except DeptModel.DoesNotExist:
                        raise ValueError(f"Department {dept_uuid} not found for designation '{name}'")

                designation = Designation.objects.create(
                    company_settings=settings,  # ✅ Changed from 'settings' to 'company_settings'
                    company=company,
                    branch_id=request.user.branch_id,
                    name=name,
                    department=dept_obj,
                    description=des_data.get('description'),
                    is_active=des_data.get('isActive', True),
                    created_by=user,
                    updated_by=user,
                )

                created.append({
                    "id": str(designation._id),
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



class DesignationEmployeesView(BaseCompanyView):
    permission_resource = 'designation'

    def get(self, request, designation_id):
        company, settings = self._get_settings(request.user)
        designation = get_object_or_404(Designation, _id=designation_id, company=company, is_deleted=False)
        employees = Employee.objects.filter(
            company_id=company.id,
            designation=designation,
            is_deleted=False,
            employment_status='ACTIVE'
        ).values('_id', 'first_name', 'last_name', 'employee_id', 'department')
        return Response(list(employees))
