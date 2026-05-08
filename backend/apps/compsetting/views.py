import logging
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from apps.compsetting.models import CompanySettings, WorkingDay, PublicHoliday, LeaveType
from apps.organization.models import Company

logger = logging.getLogger(__name__)


class CompanySettingsView(APIView):
    """Main company settings CRUD"""
    permission_classes = [IsAuthenticated]

    def _get_company(self, user):
        return get_object_or_404(Company, id=user.company_id)

    def _get_or_create_settings(self, company):
        """Get or create settings with defaults"""
        settings, created = CompanySettings.objects.get_or_create(
            company=company,
            defaults={
                "currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start": 1,
            }
        )
        
        # Create default working days if new
        if created:
            default_days = [
                ("MONDAY", True, 1),
                ("TUESDAY", True, 2),
                ("WEDNESDAY", True, 3),
                ("THURSDAY", True, 4),
                ("FRIDAY", True, 5),
                ("SATURDAY", False, 6),
                ("SUNDAY", False, 7),
            ]
            for day, is_working, order in default_days:
                WorkingDay.objects.create(
                    settings=settings,
                    day=day,
                    is_working=is_working,
                    order=order
                )
            
            # Create default leave types
            default_leave_types = [
                ("Casual Leave", "CASUAL", True, 12, 0, 1),
                ("Sick Leave", "SICK", True, 12, 0, 2),
                ("Annual Leave", "ANNUAL", True, 21, 5, 3),
                ("Maternity Leave", "MATERNITY", True, 90, 0, 4),
            ]
            for name, code, is_paid, days, carry, order in default_leave_types:
                LeaveType.objects.create(
                    settings=settings,
                    name=name,
                    code=code,
                    is_paid=is_paid,
                    default_days_per_year=days,
                    max_carry_forward_days=carry,
                    order=order
                )
        
        return settings

    def _serialize_settings(self, company, settings):
        """Full serialization including related models"""
        return {
            "companyId": company.id,
            "companyName": company.name,
            "companyShortName": company.short_name,
            "address": company.address,
            "city": company.city,
            "country": company.country,
            "phone": company.phone,
            "email": company.email,
            "taxId": settings.tax_id,
            
            # Settings
            "currency": settings.currency,
            "taxRate": str(settings.tax_rate),
            "timezone": settings.timezone,
            "leaveYearType": settings.leave_year_type,
            "fiscalYearStart": settings.fiscal_year_start,
            "leaveDuringProbation": settings.leave_during_probation,
            "allowCarryForward": settings.allow_carry_forward,
            "isSetupCompleted": settings.is_setup_completed,
            
            # Working days
            "workingDays": [
                {
                    "day": wd.day,
                    "label": wd.get_day_display(),
                    "isWorking": wd.is_working,
                    "startTime": wd.start_time.strftime("%H:%M") if wd.start_time else None,
                    "endTime": wd.end_time.strftime("%H:%M") if wd.end_time else None,
                    "order": wd.order,
                }
                for wd in settings.working_days.all()
            ],
            
            # Leave types
            "leaveTypes": [
                {
                    "id": lt.id,
                    "name": lt.name,
                    "code": lt.code,
                    "description": lt.description,
                    "isPaid": lt.is_paid,
                    "defaultDaysPerYear": lt.default_days_per_year,
                    "maxCarryForwardDays": lt.max_carry_forward_days,
                    "requiresApproval": lt.requires_approval,
                    "isActive": lt.is_active,
                    "order": lt.order,
                }
                for lt in settings.leave_types.filter(is_active=True)
            ],
            
            # Public holidays
            "publicHolidays": [
                {
                    "id": ph.id,
                    "name": ph.name,
                    "date": ph.date.isoformat(),
                    "isRecurringYearly": ph.is_recurring_yearly,
                    "description": ph.description,
                }
                for ph in settings.public_holidays.all()
            ],
        }

    def get(self, request):
        company = get_object_or_404(Company, id=request.user.company_id)
        settings = self._get_or_create_settings(company)
        
        # Optimize with prefetch
        settings = CompanySettings.objects.prefetch_related(
            'working_days',
            'leave_types',
            'public_holidays'
        ).get(id=settings.id)
        
        return Response(self._serialize_settings(company, settings))

    def patch(self, request):
        """Update core settings"""
        company = self._get_company(request.user)
        settings = self._get_or_create_settings(company)

        allowed_fields = [
            'currency', 'tax_rate', 'tax_id', 'timezone',
            'leave_year_type', 'fiscal_year_start',
            'leave_during_probation', 'allow_carry_forward',
            'is_setup_completed',
        ]

        with transaction.atomic():
            for field in allowed_fields:
                if field in request.data:
                    setattr(settings, field, request.data[field])

            # Auto-mark setup completed
            if settings.currency and not settings.is_setup_completed:
                settings.is_setup_completed = True

            settings.save()

        return Response(self._serialize_settings(company, settings))


class WorkingDaysView(APIView):
    """Manage working days"""
    permission_classes = [IsAuthenticated]

    def _get_settings(self, user):
        company = get_object_or_404(Company, id=user.company_id)
        return get_object_or_404(CompanySettings, company=company)

    def patch(self, request):
        """Update working days configuration"""
        settings = self._get_settings(request.user)
        working_days_data = request.data.get('workingDays', [])

        if not working_days_data:
            return Response(
                {'error': 'workingDays array is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            for day_data in working_days_data:
                try:
                    working_day = WorkingDay.objects.get(
                        settings=settings,
                        day=day_data['day']
                    )
                except WorkingDay.DoesNotExist:
                    continue

                working_day.is_working = day_data.get('isWorking', True)
                
                if 'startTime' in day_data and day_data['startTime']:
                    working_day.start_time = day_data['startTime']
                if 'endTime' in day_data and day_data['endTime']:
                    working_day.end_time = day_data['endTime']
                    
                working_day.save()

        return Response({'message': 'Working days updated successfully'})


class LeaveTypesView(APIView):
    """CRUD for leave types"""
    permission_classes = [IsAuthenticated]

    def _get_settings(self, user):
        company = get_object_or_404(Company, id=user.company_id)
        return get_object_or_404(CompanySettings, company=company)

    def get(self, request):
        """Get all leave types"""
        settings = self._get_settings(request.user)
        leave_types = settings.leave_types.all()
        
        return Response([
            {
                "id": lt.id,
                "name": lt.name,
                "code": lt.code,
                "description": lt.description,
                "isPaid": lt.is_paid,
                "defaultDaysPerYear": lt.default_days_per_year,
                "maxCarryForwardDays": lt.max_carry_forward_days,
                "requiresApproval": lt.requires_approval,
                "isActive": lt.is_active,
                "order": lt.order,
            }
            for lt in leave_types
        ])

    def post(self, request):
        """Create new leave type"""
        settings = self._get_settings(request.user)
        
        required_fields = ['name', 'code']
        for field in required_fields:
            if field not in request.data:
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        leave_type = LeaveType.objects.create(
            settings=settings,
            name=request.data['name'],
            code=request.data['code'].upper(),
            description=request.data.get('description', ''),
            is_paid=request.data.get('isPaid', True),
            default_days_per_year=request.data.get('defaultDaysPerYear', 0),
            max_carry_forward_days=request.data.get('maxCarryForwardDays', 0),
            requires_approval=request.data.get('requiresApproval', True),
            order=request.data.get('order', 0),
        )

        return Response({
            "id": leave_type.id,
            "name": leave_type.name,
            "code": leave_type.code,
            "isPaid": leave_type.is_paid,
            "defaultDaysPerYear": leave_type.default_days_per_year,
        }, status=status.HTTP_201_CREATED)

    def patch(self, request):
        """Update leave type"""
        settings = self._get_settings(request.user)
        leave_type_id = request.data.get('id')

        if not leave_type_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_type = get_object_or_404(
            LeaveType, id=leave_type_id, settings=settings
        )

        updatable_fields = [
            'name', 'description', 'is_paid', 
            'default_days_per_year', 'max_carry_forward_days',
            'requires_approval', 'is_active', 'order'
        ]

        for field in updatable_fields:
            camel_field = self._to_camel_case(field)
            if camel_field in request.data:
                setattr(leave_type, field, request.data[camel_field])

        leave_type.save()
        return Response({'message': 'Leave type updated successfully'})

    def _to_camel_case(self, snake_str):
        components = snake_str.split('_')
        return components[0] + ''.join(x.title() for x in components[1:])


class PublicHolidaysView(APIView):
    """CRUD for public holidays"""
    permission_classes = [IsAuthenticated]

    def _get_settings(self, user):
        company = get_object_or_404(Company, id=user.company_id)
        return get_object_or_404(CompanySettings, company=company)

    def get(self, request):
        """Get all public holidays"""
        settings = self._get_settings(request.user)
        year = request.query_params.get('year')
        
        query = settings.public_holidays.all()
        if year:
            query = query.filter(date__year=year)
        
        return Response([
            {
                "id": ph.id,
                "name": ph.name,
                "date": ph.date.isoformat(),
                "isRecurringYearly": ph.is_recurring_yearly,
                "description": ph.description,
            }
            for ph in query
        ])

    def post(self, request):
        """Add public holiday"""
        settings = self._get_settings(request.user)
        
        required_fields = ['name', 'date']
        for field in required_fields:
            if field not in request.data:
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        holiday = PublicHoliday.objects.create(
            settings=settings,
            name=request.data['name'],
            date=request.data['date'],
            is_recurring_yearly=request.data.get('isRecurringYearly', False),
            description=request.data.get('description', ''),
        )

        return Response({
            "id": holiday.id,
            "name": holiday.name,
            "date": holiday.date.isoformat(),
        }, status=status.HTTP_201_CREATED)

    def delete(self, request, holiday_id):
        """Remove public holiday"""
        settings = self._get_settings(request.user)
        holiday = get_object_or_404(
            PublicHoliday, id=holiday_id, settings=settings
        )
        holiday.delete()
        return Response({'message': 'Holiday removed successfully'})