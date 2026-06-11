import os
from django.core.management.base import BaseCommand
from apps.organization.models import Company, Branch, User
from apps.inventory.models import Warehouse
from apps.compsetting.models import CompanySettings, WorkingDay


class Command(BaseCommand):
    help = 'Seed initial company, branch, admin user, default warehouse, and company settings'

    def handle(self, *args, **kwargs):

        company_name = os.environ.get('ORG_COMPANY_NAME', 'My Company')
        company_short = os.environ.get('ORG_COMPANY_SHORT', 'MC')

        branch_name = os.environ.get('ORG_BRANCH_NAME', 'Head Office')
        branch_code = os.environ.get('ORG_BRANCH_CODE', 'HQ01')

        admin_user = os.environ.get('ORG_ADMIN_USERNAME', 'admin')
        admin_email = os.environ.get('ORG_ADMIN_EMAIL', 'admin@example.com')
        admin_pass = os.environ.get('ORG_ADMIN_PASSWORD', 'admin123')

        # -------------------------
        # COMPANY
        # -------------------------
        company, created = Company.objects.get_or_create(
            short_name=company_short,
            defaults={
                'name': company_name,
                'city': 'N/A',
                'country': 'N/A',
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Company created: {company.name}'))
        else:
            self.stdout.write(f'— Company exists: {company.name}')

        # -------------------------
        # BRANCH
        # -------------------------
        branch, created = Branch.objects.get_or_create(
            company=company,
            code=branch_code,
            defaults={
                'name': branch_name,
                'city': 'N/A',
                'country': 'N/A',
                'is_hq': True,
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Branch created: {branch.name}'))
        else:
            self.stdout.write(f'— Branch exists: {branch.name}')

        # -------------------------
        # ADMIN USER
        # -------------------------
        user = User.objects.filter(username=admin_user).first()
        if not user:
            user = User.objects.create_user(
                username=admin_user,
                email=admin_email,
                password=admin_pass,
            )
            user.is_staff = True
            user.is_superuser = True
            user.role = 'COMPANY_ADMIN'
            user.company = company
            user.branch = branch
            user.save()
            self.stdout.write(self.style.SUCCESS(f'✓ Admin created: {admin_user}'))
        else:
            self.stdout.write(f'— Admin exists: {admin_user}')

        # -------------------------
        # DEFAULT WAREHOUSE
        # -------------------------
        warehouse_code = os.environ.get('ORG_WAREHOUSE_CODE', 'WH01')
        warehouse_name = os.environ.get('ORG_WAREHOUSE_NAME', 'Main Warehouse')

        warehouse_exists = Warehouse.objects.filter(
            company_id=company.id,
            branch_id=branch.id,
            code=warehouse_code,
            is_deleted=False
        ).exists()

        if not warehouse_exists:
            Warehouse.objects.create(
                company_id=company.id,
                branch_id=branch.id,
                code=warehouse_code,
                warehouse_name=warehouse_name,
                country=company.country,
                city=company.city,
                address_line='Default warehouse address',
                is_active=True,
                created_by=user,
                updated_by=user,
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Default warehouse created: {warehouse_name} ({warehouse_code})'))
        else:
            self.stdout.write(f'— Warehouse already exists: {warehouse_code}')

        # -------------------------
        # COMPANY SETTINGS & WORKING DAYS
        # -------------------------
        settings, settings_created = CompanySettings.objects.get_or_create(
            company=company,
            defaults={
                'currency': 'USD',
                'timezone': 'UTC',
                'default_start_time': '09:00:00',
                'default_end_time': '18:00:00',
                'working_hours_per_day': 8.00,
                'created_by': user,
                'updated_by': user,
            }
        )
        if settings_created:
            self.stdout.write(self.style.SUCCESS(f'✓ Company settings created for {company.name}'))
        else:
            self.stdout.write(f'— Company settings already exist for {company.name}')

        # Create default working days (Monday=0 .. Sunday=6)
        # NOTE: WorkingDay model now uses 'company_settings' instead of 'settings'
        default_days = [
            {'day': 0, 'is_working': True,  'start_time': '09:00', 'end_time': '18:00'},
            {'day': 1, 'is_working': True,  'start_time': '09:00', 'end_time': '18:00'},
            {'day': 2, 'is_working': True,  'start_time': '09:00', 'end_time': '18:00'},
            {'day': 3, 'is_working': True,  'start_time': '09:00', 'end_time': '18:00'},
            {'day': 4, 'is_working': True,  'start_time': '09:00', 'end_time': '18:00'},
            {'day': 5, 'is_working': False, 'start_time': '09:00', 'end_time': '18:00'},
            {'day': 6, 'is_working': False, 'start_time': '09:00', 'end_time': '18:00'},
        ]

        working_days_created = 0
        for day_data in default_days:
            # Use company_settings instead of settings
            obj, created = WorkingDay.objects.get_or_create(
                company_settings=settings,  # ✅ Changed from 'settings' to 'company_settings'
                day=day_data['day'],
                defaults={
                    'company': company,
                    'is_working': day_data['is_working'],
                    'start_time': day_data['start_time'],
                    'end_time': day_data['end_time'],
                    'is_half_day': False,
                    'created_by': user,
                    'updated_by': user,
                }
            )
            if created:
                working_days_created += 1

        if working_days_created:
            self.stdout.write(self.style.SUCCESS(f'✓ Created {working_days_created} default working days'))
        else:
            self.stdout.write('— Working days already exist')

        self.stdout.write(self.style.SUCCESS('\nSeeding completed successfully.'))