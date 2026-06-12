# apps/hr/services/leave_calculation.py
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Dict, Optional, Tuple
from django.db import models
from django.utils import timezone
from apps.compsetting.models import WorkingDay, PublicHoliday, CompanySettings


class LeaveCalculationService:
    """Service for calculating leave days and balances"""
    
    @staticmethod
    def get_working_days_config(company_id: int) -> Tuple[List[int], List[date]]:
        """Get working days and holidays for a company"""
        
        # Get working days configuration
        working_days = WorkingDay.objects.filter(
            company_id=company_id,
            is_deleted=False,
            is_working=True
        ).values_list('day', flat=True)
        
        working_days_list = list(working_days) if working_days else [0, 1, 2, 3, 4]  # Mon-Fri default
        
        # Get holidays for current year and next year (for date ranges crossing year boundary)
        current_year = date.today().year
        holidays = PublicHoliday.objects.filter(
            company_id=company_id,
            is_deleted=False,
            date__year__in=[current_year, current_year + 1]
        ).values_list('date', flat=True)
        
        return working_days_list, list(holidays)
    
    @staticmethod
    def calculate_working_days(start_date: date, end_date: date, company_id: int) -> Decimal:
        """Calculate working days between two dates"""
        
        working_days_list, holidays = LeaveCalculationService.get_working_days_config(company_id)
        
        days = Decimal('0')
        current = start_date
        end = end_date
        
        while current <= end:
            # Check if it's a working day (0 = Monday, 6 = Sunday)
            is_working_day = current.weekday() in working_days_list
            
            # Check if it's a holiday
            is_holiday = current in holidays
            
            if is_working_day and not is_holiday:
                days += Decimal('1')
            
            current += timedelta(days=1)
        
        return days
    
    @staticmethod
    def validate_leave_request(
        employee_id: int,
        leave_type_id: int,
        start_date: date,
        end_date: date,
        is_half_day: bool = False,
        company_id: int = None
    ) -> Dict:
        """Validate leave request before submission"""
        
        from apps.hr.models import LeaveBalance, LeaveRequest
        from apps.hr.models import Employee
        from apps.compsetting.models import LeaveType
        
        result = {
            'valid': True,
            'error': None,
            'days': Decimal('0'),
            'balance': None
        }
        
        try:
            leave_type = LeaveType.objects.get(id=leave_type_id, is_deleted=False)
            employee = Employee.objects.get(id=employee_id, is_deleted=False)
            company_id = company_id or employee.company_id
            
            # Calculate requested days
            requested_days = LeaveCalculationService.calculate_working_days(
                start_date, end_date, company_id
            )
            
            if is_half_day and requested_days == 1:
                requested_days = Decimal('0.5')
            
            result['days'] = requested_days
            # Check min/max days per request
            if requested_days < leave_type.min_days_per_request:
                result['valid'] = False
                result['error'] = f"Minimum {leave_type.min_days_per_request} day(s) required for this leave type"
                return result
            
            if requested_days > leave_type.max_days_per_request:
                result['valid'] = False
                result['error'] = f"Maximum {leave_type.max_days_per_request} day(s) allowed for this leave type"
                return result
            
            # Check applicable after months
            if leave_type.applicable_after_months > 0:
                joining_date = employee.joining_date
                today = date.today()
                months_since_joining = (today.year - joining_date.year) * 12 + (today.month - joining_date.month)
                if months_since_joining < leave_type.applicable_after_months:
                    result['valid'] = False
                    result['error'] = f"This leave type is only available after {leave_type.applicable_after_months} months of employment"
                    return result
            
            # Check gender restriction
            if leave_type.gender_specific != 'ALL' and leave_type.gender_specific != employee.gender:
                result['valid'] = False
                result['error'] = f"This leave type is only for {leave_type.gender_specific.lower()} employees"
                return result
            
            # Get current balance
            current_year = start_date.year
            balance = LeaveBalance.objects.filter(
                employee_id=employee_id,
                leave_type_id=leave_type_id,
                year=current_year,
                is_deleted=False
            ).first()
            
            if balance:
                result['balance'] = {
                    'allocated': float(balance.allocated),
                    'used': float(balance.used),
                    'available': float(balance.available),
                    'carry_forward_from': float(balance.carry_forward_from)
                }
                
                if balance.available < requested_days:
                    result['valid'] = False
                    result['error'] = f"Insufficient leave balance. Available: {balance.available}, Requested: {requested_days}"
            else:
                # No balance record - use leave type default
                default_available = leave_type.default_days_per_year
                result['balance'] = {
                    'allocated': float(default_available),
                    'used': 0,
                    'available': float(default_available),
                    'carry_forward_from': 0
                }
                
                if default_available < requested_days:
                    result['valid'] = False
                    result['error'] = f"Insufficient leave balance. Available: {default_available}, Requested: {requested_days}"
            
            # Check for overlapping leave requests
            overlapping = LeaveRequest.objects.filter(
                employee_id=employee_id,
                status__in=['PENDING', 'APPROVED'],
                is_deleted=False,
                start_date__lte=end_date,
                end_date__gte=start_date
            ).exclude(status='CANCELLED')
            
            if overlapping.exists():
                result['valid'] = False
                result['error'] = "You have an overlapping leave request for this period"
            
        except LeaveType.DoesNotExist:
            result['valid'] = False
            result['error'] = "Invalid leave type"
        except Employee.DoesNotExist:
            result['valid'] = False
            result['error'] = "Employee not found"
        except Exception as e:
            result['valid'] = False
            result['error'] = str(e)
        
        return result


class LeaveBalanceService:
    """Service for managing leave balances"""
    
    @staticmethod
    def get_or_create_balance(
        employee_id: int,
        leave_type_id: int,
        year: int,
        company_id: int
    ) -> 'LeaveBalance':
        """Get or create leave balance for an employee"""
        from apps.hr.models import LeaveBalance
        from apps.compsetting.models import LeaveType
        from apps.hr.models import Employee
        
        balance, created = LeaveBalance.objects.get_or_create(
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            year=year,
            company_id=company_id,
            defaults={
                'allocated': 0,
                'used': 0,
                'available': 0,
                'carry_forward_from': 0,
            }
        )
        
        # If created, set default allocation from leave type
        if created:
            try:
                leave_type = LeaveType.objects.get(id=leave_type_id, is_deleted=False)
                employee = Employee.objects.get(id=employee_id, is_deleted=False)
                
                balance.employee_name = employee.full_name if hasattr(employee, 'full_name') else str(employee)
                balance.leave_type_name = leave_type.name
                balance.allocated = leave_type.default_days_per_year
                balance.available = leave_type.default_days_per_year
                balance.save()
            except Exception:
                pass
        
        return balance
    
    @staticmethod
    def update_balance_on_approval(
        leave_request: 'LeaveRequest',
        user
    ) -> None:
        """Update leave balance when leave is approved"""
        from apps.hr.models import LeaveBalance, LeaveBalanceHistory
        
        balance = LeaveBalance.objects.filter(
            employee_id=leave_request.employee_id,
            leave_type_id=leave_request.leave_type_id,
            year=leave_request.start_date.year,
            company_id=leave_request.company_id,
            is_deleted=False
        ).first()
        
        if not balance:
            # Create balance if it doesn't exist
            balance = LeaveBalanceService.get_or_create_balance(
                leave_request.employee_id,
                leave_request.leave_type_id,
                leave_request.start_date.year,
                leave_request.company_id
            )
        
        # Store previous values for history
        previous_used = balance.used
        previous_available = balance.available
        
        # Update balance
        balance.used += leave_request.total_days
        balance.available = balance.allocated - balance.used + balance.carry_forward_from
        
        if balance.available < 0:
            balance.available = Decimal('0')
        
        balance.updated_by = user
        balance.save()
        
        # Create history record
        LeaveBalanceHistory.objects.create(
            company_id=leave_request.company_id,
            balance=balance,
            employee=leave_request.employee,
            leave_type=leave_request.leave_type,
            action='LEAVE_APPROVED',
            previous_used=previous_used,
            new_used=balance.used,
            delta=leave_request.total_days,
            previous_available=previous_available,
            new_available=balance.available,
            leave_request=leave_request,
            performed_by=user,
            notes=f"Leave approved: {leave_request.start_date} to {leave_request.end_date}"
        )
    
    @staticmethod
    def revert_balance_on_cancellation(
        leave_request: 'LeaveRequest',
        user
    ) -> None:
        """Revert leave balance when leave is cancelled/rejected"""
        from apps.hr.models import LeaveBalance, LeaveBalanceHistory
        
        balance = LeaveBalance.objects.filter(
            employee_id=leave_request.employee_id,
            leave_type_id=leave_request.leave_type_id,
            year=leave_request.start_date.year,
            company_id=leave_request.company_id,
            is_deleted=False
        ).first()
        
        if balance:
            previous_used = balance.used
            previous_available = balance.available
            
            balance.used -= leave_request.total_days
            if balance.used < 0:
                balance.used = Decimal('0')
            
            balance.available = balance.allocated - balance.used + balance.carry_forward_from
            balance.updated_by = user
            balance.save()
            
            # Create history record
            LeaveBalanceHistory.objects.create(
                company_id=leave_request.company_id,
                balance=balance,
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                action='LEAVE_CANCELLED',
                previous_used=previous_used,
                new_used=balance.used,
                delta=-leave_request.total_days,
                previous_available=previous_available,
                new_available=balance.available,
                leave_request=leave_request,
                performed_by=user,
                notes=f"Leave cancelled: {leave_request.start_date} to {leave_request.end_date}"
            )
    
    @staticmethod
    def process_year_end_carry_forward(company_id: int, from_year: int, user) -> Dict:
        """Process year-end carry forward for all employees"""
        from apps.hr.models import LeaveBalance, YearEndCarryForward
        from apps.compsetting.models import LeaveType, CompanySettings
        
        # Get company settings
        settings = CompanySettings.objects.filter(company_id=company_id).first()
        if not settings or not settings.allow_carry_forward:
            return {
                'success': False,
                'error': 'Carry forward is not enabled for this company'
            }
        
        # Create process record
        process = YearEndCarryForward.objects.create(
            company_id=company_id,
            from_year=from_year,
            to_year=from_year + 1,
            status='PROCESSING',
            processed_by=user
        )
        
        try:
            balances = LeaveBalance.objects.filter(
                company_id=company_id,
                year=from_year,
                is_deleted=False,
                available__gt=0
            ).select_related('leave_type')
            
            processed_count = 0
            updated_count = 0
            total_carried = Decimal('0')
            
            for balance in balances:
                leave_type = balance.leave_type
                max_carry = leave_type.max_carry_forward_days or settings.max_carry_forward_days or 0
                
                if max_carry > 0 and balance.available > 0:
                    carry_amount = min(balance.available, Decimal(str(max_carry)))
                    
                    if carry_amount > 0:
                        # Create next year balance
                        next_year_balance, created = LeaveBalance.objects.get_or_create(
                            company_id=company_id,
                            employee=balance.employee,
                            leave_type=balance.leave_type,
                            year=from_year + 1,
                            defaults={
                                'branch': balance.branch,
                                'employee_name': balance.employee_name,
                                'leave_type_name': balance.leave_type_name,
                                'allocated': leave_type.default_days_per_year,
                                'used': 0,
                                'available': leave_type.default_days_per_year,
                                'carry_forward_from': 0,
                                'created_by': user,
                                'updated_by': user,
                            }
                        )
                        
                        if created:
                            # Update with carry forward amount
                            next_year_balance.carry_forward_from = carry_amount
                            next_year_balance.available = next_year_balance.allocated + carry_amount
                            next_year_balance.updated_by = user
                            next_year_balance.save()
                            updated_count += 1
                            total_carried += carry_amount
                        
                        processed_count += 1
            
            process.status = 'COMPLETED'
            process.completed_at = timezone.now()
            process.total_employees_processed = processed_count
            process.total_balances_updated = updated_count
            process.total_days_carried = total_carried
            process.save()
            
            return {
                'success': True,
                'processed': processed_count,
                'updated': updated_count,
                'total_carried': float(total_carried)
            }
            
        except Exception as e:
            process.status = 'FAILED'
            process.error_log = str(e)
            process.save()
            return {
                'success': False,
                'error': str(e)
            }