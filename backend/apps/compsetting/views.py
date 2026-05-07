import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404

from apps.compsetting.models import CompanySettings
from apps.organization.models import Company

logger = logging.getLogger(__name__)


class CompanySettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_company(self, user):
        return get_object_or_404(Company, id=user.company_id)

    def _serialize_settings(self, company, settings):
        return {
            "companyName": company.name,
            "currency": settings.currency,
            "taxRate": str(settings.tax_rate),
            "taxId": settings.tax_id,
            "timezone": settings.timezone,
            "leaveYearType": settings.leave_year_type,
            "fiscalYearStart": settings.fiscal_year_start,
            "publicHolidays": settings.public_holidays,
            "workingDays": settings.working_days,
            "weekends": settings.weekends,
            "isSetupCompleted": settings.is_setup_completed,
        }

    def get(self, request):
        company = self._get_company(request.user)

        # get_or_create returns (instance, created_bool) — fixed from broken .get()
        settings, created = CompanySettings.objects.get_or_create(
            company=company,
            defaults={
                "currency": "USD",
                "timezone": "UTC",
                "fiscal_year_start": 1,
                "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "weekends": ["Saturday", "Sunday"],
            }
        )

        return Response(self._serialize_settings(company, settings))

    def patch(self, request):
        company = self._get_company(request.user)
        settings, _ = CompanySettings.objects.get_or_create(company=company)

        allowed_fields = [
            'currency', 'tax_rate', 'tax_id', 'timezone',
            'leave_year_type', 'fiscal_year_start',
            'public_holidays', 'working_days', 'weekends',
            'is_setup_completed',
        ]

        for field in allowed_fields:
            if field in request.data:
                setattr(settings, field, request.data[field])

        # Auto-mark setup completed once currency is set
        if settings.currency and not settings.is_setup_completed:
            settings.is_setup_completed = True

        settings.save()
        return Response(self._serialize_settings(company, settings))