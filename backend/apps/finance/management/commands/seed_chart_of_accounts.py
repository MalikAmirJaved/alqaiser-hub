from django.core.management.base import BaseCommand
from apps.finance.models import Account
from apps.organization.models import Company, Branch  # adjust imports

class Command(BaseCommand):
    help = "Seed basic chart of accounts"

    def add_arguments(self, parser):
        parser.add_argument(
            "--company-id",
            type=int,
            required=True,
        )
        parser.add_argument(
            "--branch-id",
            type=int,
            required=True,
        )

    def handle(self, *args, **options):
        company_id = options["company_id"]
        branch_id = options["branch_id"]

        try:
            company = Company.objects.get(id=company_id)
        except Company.DoesNotExist:
            self.stdout.write(self.style.ERROR("Invalid company_id"))
            return

        try:
            branch = Branch.objects.get(id=branch_id, company_id=company_id)
        except Branch.DoesNotExist:
            self.stdout.write(self.style.ERROR("Invalid branch_id for this company"))
            return

        accounts = [
            ("CASH", "Cash", "ASSET"),
            ("BANK", "Bank Account", "ASSET"),
            ("INVENTORY", "Inventory Asset", "ASSET"),
            ("AR", "Accounts Receivable", "ASSET"),
            ("AP", "Accounts Payable", "LIABILITY"),
            ("SALES", "Sales Revenue", "INCOME"),
            ("COGS", "Cost of Goods Sold", "EXPENSE"),
            ("RENT", "Rent Expense", "EXPENSE"),
            ("SALARIES", "Salaries Expense", "EXPENSE"),
            ("EQUITY", "Owner's Equity", "EQUITY"),
        ]

        created_count = 0

        for code, name, typ in accounts:
            obj, created = Account.objects.get_or_create(
                company_id=company.id,
                branch_id=branch.id,
                code=code,
                defaults={
                    "name": name,
                    "account_type": typ,
                },
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created_count} accounts for company={company.id}, branch={branch.id}"
            )
        )