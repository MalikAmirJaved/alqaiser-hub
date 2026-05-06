import os
from django.core.management.base import BaseCommand
from apps.organization.models import Company, Branch, User


class Command(BaseCommand):
    help = 'Seed initial company, branch and admin user from env'

    def handle(self, *args, **kwargs):
        company_name  = os.environ.get('ORG_COMPANY_NAME', 'My Company')
        company_short = os.environ.get('ORG_COMPANY_SHORT', 'MC')
        branch_name   = os.environ.get('ORG_BRANCH_NAME', 'Head Office')
        branch_code   = os.environ.get('ORG_BRANCH_CODE', 'HQ01')
        admin_user    = os.environ.get('ORG_ADMIN_USERNAME', 'admin')
        admin_email   = os.environ.get('ORG_ADMIN_EMAIL', 'admin@example.com')
        admin_pass    = os.environ.get('ORG_ADMIN_PASSWORD', 'admin123')

        company, created = Company.objects.get_or_create(
            short_name=company_short,
            defaults={'name': company_name, 'city': 'N/A', 'country': 'N/A'}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Company created: {company_name}'))
        else:
            self.stdout.write(f'— Company already exists: {company_name}')

        branch, created = Branch.objects.get_or_create(
            code=branch_code,
            company=company,
            defaults={
                'name': branch_name,
                'city': 'N/A',
                'country': 'N/A',
                'is_hq': True
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Branch created: {branch_name}'))
        else:
            self.stdout.write(f'— Branch already exists: {branch_name}')

        if not User.objects.filter(username=admin_user).exists():
            User.objects.create_superuser(
                username=admin_user,
                email=admin_email,
                password=admin_pass,
                company=company,
                branch=branch,
                role='admin'
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Admin user created: {admin_user}'))
        else:
            self.stdout.write(f'— Admin user already exists: {admin_user}')