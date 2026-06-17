# apps/hr/views/promotion_views.py
from datetime import date, datetime
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from apps.permissions.mixins import PermissionRequiredMixin
from apps.hr.models import Employee, EmployeePromotion


class PromotionView(PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'employee'
    permission_classes = [IsAuthenticated]

    def get_permission_action(self):
        method = self.request.method.upper()
        if method == 'POST':
            return 'update'
        return 'view'

    def _serialize_promotion(self, promotion):
        return {
            "id": str(promotion._id),
            "employee_id": str(promotion.employee._id) if promotion.employee else None,
            "employee_name": promotion.employee.full_name if promotion.employee else None,
            "previous_salary": str(promotion.previous_salary),
            "new_salary": str(promotion.new_salary),
            "effective_date": promotion.effective_date.isoformat() if promotion.effective_date else None,
            "notes": promotion.notes,
            "approved_by": str(promotion.approved_by._id) if promotion.approved_by else None,
            "approved_at": promotion.approved_at.isoformat() if promotion.approved_at else None,
            "created_at": promotion.created_at.isoformat() if promotion.created_at else None,
        }

    def get(self, request, pk=None):
        company_id = request.user.company_id
        if not company_id:
            return Response({'error': 'User is not associated with any company'}, status=status.HTTP_400_BAD_REQUEST)

        if pk:
            promotion = get_object_or_404(EmployeePromotion, _id=pk, company_id=company_id, is_deleted=False)
            return Response(self._serialize_promotion(promotion))

        employee_uuid = request.query_params.get('employee_id')
        query = EmployeePromotion.objects.filter(company_id=company_id, is_deleted=False).select_related('employee')
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        promotions = query.order_by('-effective_date', '-created_at')
        return Response([self._serialize_promotion(p) for p in promotions])

    @transaction.atomic
    def post(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        if not company_id:
            return Response({'error': 'User is not associated with any company'}, status=status.HTTP_400_BAD_REQUEST)

        employee_uuid = request.data.get('employee_id')
        new_salary = float(request.data.get('new_salary', 0))
        effective_date_str = request.data.get('effective_date')

        if not employee_uuid or new_salary <= 0:
            return Response({'error': 'employee_id and new_salary are required'}, status=status.HTTP_400_BAD_REQUEST)

        employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
        previous_salary = float(employee.salary)

        # Parse date from string or use today
        if effective_date_str:
            try:
                effective_date = datetime.strptime(effective_date_str, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                effective_date = date.today()
        else:
            effective_date = date.today()

        promotion = EmployeePromotion.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            employee=employee,
            previous_salary=previous_salary,
            new_salary=new_salary,
            effective_date=effective_date,
            notes=request.data.get('notes', ''),
            approved_by=request.user,
            approved_at=timezone.now(),
            created_by=request.user,
            updated_by=request.user,
        )

        employee.salary = new_salary
        employee.save(update_fields=['salary', 'updated_at'])

        return Response({
            "message": f"Promotion processed: {previous_salary} → {new_salary}",
            "promotion": self._serialize_promotion(promotion)
        }, status=status.HTTP_201_CREATED)
