import os
from django.core.management.base import BaseCommand
from apps.organization.models import Company, Branch, User


class Command(BaseCommand):
    help = 'Seed initial company, branch and admin user from env'

    def handle(self, *args, **kwargs):

        company_name = os.environ.get('ORG_COMPANY_NAME', 'My Company')
        company_short = os.environ.get('ORG_COMPANY_SHORT', 'MC')

        branch_name = os.environ.get('ORG_BRANCH_NAME', 'Head Office')
        branch_code = os.environ.get('ORG_BRANCH_CODE', 'HQ01')

        admin_user = os.environ.get('ORG_ADMIN_USERNAME', 'admin')
        admin_email = os.environ.get('ORG_ADMIN_EMAIL', 'admin@example.com')
        admin_pass = os.environ.get('ORG_ADMIN_PASSWORD', 'admin123')

        # -------------------------
        # COMPANY (safe get_or_create)
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
        # BRANCH (safe + company scoped)
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
        # USER (IMPORTANT FIX)
        # DO NOT use create_superuser with custom fields
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
            user.role = 'admin'
            user.company = company
            user.branch = branch
            user.save()

            self.stdout.write(self.style.SUCCESS(f'✓ Admin created: {admin_user}'))
        else:
            self.stdout.write(f'— Admin exists: {admin_user}')