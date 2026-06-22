from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.baseauthentication import CompanyBranchMixin
from apps.finance.models import (
    Account,
    BankAccount,
    CustomerInvoice,
    Expense,
    JournalLine,
    Payment,
    SupplierBill,
)
from apps.finance.services.payable import get_outstanding
from apps.hr.models import Asset
from apps.permissions.mixins import PermissionRequiredMixin


def to_decimal(val):
    return val if val is not None else Decimal("0.00")


def get_company_branch(request):
    return request.user.company_id, request.user.branch_id


def compute_account_balance(company_id, branch_id, account, start_date=None, end_date=None, as_of_date=None):
    """
    Compute the live balance for a single Account object by mapping its code
    to real transactional data.  Falls back to journal lines when no specific
    mapping exists.
    """
    code = account.code
    balance = Decimal("0.00")

    # Build shared date filter
    date_filter = Q()
    if start_date:
        date_filter &= Q(expense_date__gte=start_date)
    if end_date:
        date_filter &= Q(expense_date__lte=end_date)

    pay_date_filter = Q()
    if start_date:
        pay_date_filter &= Q(payment_date__gte=start_date)
    if end_date:
        pay_date_filter &= Q(payment_date__lte=end_date)

    inv_date_filter = Q()
    if start_date:
        inv_date_filter &= Q(invoice_date__gte=start_date)
    if end_date:
        inv_date_filter &= Q(invoice_date__lte=end_date)

    bill_date_filter = Q()
    if start_date:
        bill_date_filter &= Q(bill_date__gte=start_date)
    if end_date:
        bill_date_filter &= Q(bill_date__lte=end_date)

    if code == "AR":
        qs = CustomerInvoice.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False,
        ).exclude(status="CANCELLED")
        if start_date or end_date:
            qs = qs.filter(inv_date_filter)
        balance = sum(get_outstanding(inv) for inv in qs)

    elif code == "AP":
        qs = SupplierBill.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False,
        ).exclude(status="CANCELLED")
        if start_date or end_date:
            qs = qs.filter(bill_date_filter)
        balance = sum(get_outstanding(bill) for bill in qs)

    elif code == "INVENTORY":
        assets = Asset.objects.filter(
            company_id=company_id, is_deleted=False
        )
        balance = sum(
            (asset.purchase_price or Decimal("0.00")) * asset.available_quantity
            for asset in assets
        )

    elif code == "SALES":
        qs = Payment.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            status="CONFIRMED",
            payment_type="RECEIPT",
            is_deleted=False,
        )
        if start_date or end_date:
            qs = qs.filter(pay_date_filter)
        balance = to_decimal(qs.aggregate(total=Sum("amount"))["total"])

    elif code == "RENT":
        qs = Expense.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False, category="RENT",
        )
        if start_date or end_date:
            qs = qs.filter(date_filter)
        balance = to_decimal(qs.aggregate(total=Sum("amount"))["total"])

    elif code == "SALARIES":
        qs = Expense.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False, category="SALARIES",
        )
        if start_date or end_date:
            qs = qs.filter(date_filter)
        balance = to_decimal(qs.aggregate(total=Sum("amount"))["total"])

    elif code in ("OTHER_EXPENSES", "OTHER_EXPENSE"):
        qs = Expense.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False,
        ).exclude(category__in=["RENT", "SALARIES"])
        if start_date or end_date:
            qs = qs.filter(date_filter)
        balance = to_decimal(qs.aggregate(total=Sum("amount"))["total"])

    elif code == "COGS":
        qs = Expense.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False, category="COGS",
        )
        if start_date or end_date:
            qs = qs.filter(date_filter)
        balance = to_decimal(qs.aggregate(total=Sum("amount"))["total"])
        if balance == Decimal("0.00"):
            lines = JournalLine.objects.filter(
                account=account,
                journal_entry__is_posted=True,
                company_id=company_id,
                branch_id=branch_id,
            )
            if start_date:
                lines = lines.filter(journal_entry__date__gte=start_date)
            if end_date:
                lines = lines.filter(journal_entry__date__lte=end_date)
            total_debit = to_decimal(lines.aggregate(total=Sum("debit"))["total"])
            total_credit = to_decimal(lines.aggregate(total=Sum("credit"))["total"])
            balance = total_debit - total_credit

    elif code in ("CASH", "BANK"):
        balance = to_decimal(
            BankAccount.objects.filter(
                company_id=company_id,
                branch_id=branch_id,
                is_active=True,
                is_deleted=False,
            ).aggregate(total=Sum("book_balance"))["total"]
        )

    elif code == "EQUITY":
        lines = JournalLine.objects.filter(
            account=account,
            journal_entry__is_posted=True,
            company_id=company_id,
            branch_id=branch_id,
        )
        if as_of_date:
            lines = lines.filter(journal_entry__date__lte=as_of_date)
        total_debit = to_decimal(lines.aggregate(total=Sum("debit"))["total"])
        total_credit = to_decimal(lines.aggregate(total=Sum("credit"))["total"])
        balance = total_credit - total_debit

    else:
        # Fallback: posted journal lines
        lines = JournalLine.objects.filter(
            account=account,
            journal_entry__is_posted=True,
            company_id=company_id,
            branch_id=branch_id,
        )
        if start_date:
            lines = lines.filter(journal_entry__date__gte=start_date)
        if end_date:
            lines = lines.filter(journal_entry__date__lte=end_date)
        if as_of_date:
            lines = lines.filter(journal_entry__date__lte=as_of_date)
        total_debit = to_decimal(lines.aggregate(total=Sum("debit"))["total"])
        total_credit = to_decimal(lines.aggregate(total=Sum("credit"))["total"])

        if account.account_type in ("ASSET", "EXPENSE"):
            balance = total_debit - total_credit
        elif account.account_type in ("LIABILITY", "EQUITY", "INCOME"):
            balance = total_credit - total_debit

    return balance


class ReportViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.GenericViewSet):
    permission_module = "FINANCE"
    permission_resource = "finance_reports"

    # ------------------------------------------------------------------
    # TRIAL BALANCE
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"])
    def trial_balance(self, request):
        """
        Trial balance computed from live transactional data, with journal
        entry fallback for accounts that don't have a specific mapping.
        """
        company_id, branch_id = get_company_branch(request)
        as_of_date = request.query_params.get("as_of_date")

        accounts = Account.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False
        )
        result = []
        total_debits = Decimal("0.00")
        total_credits = Decimal("0.00")

        for account in accounts:
            balance = compute_account_balance(
                company_id, branch_id, account, as_of_date=as_of_date,
            )
            # Debit-normal accounts show positive as debit
            if account.account_type in ("ASSET", "EXPENSE"):
                if balance >= 0:
                    debit = balance
                    credit = Decimal("0.00")
                else:
                    debit = Decimal("0.00")
                    credit = abs(balance)
            else:
                if balance >= 0:
                    debit = Decimal("0.00")
                    credit = balance
                else:
                    debit = abs(balance)
                    credit = Decimal("0.00")

            result.append(
                {
                    "account_id": account.id,
                    "code": account.code,
                    "name": account.name,
                    "account_type": account.account_type,
                    "debit": debit,
                    "credit": credit,
                    "balance": balance,
                }
            )
            total_debits += debit
            total_credits += credit

        result.sort(key=lambda x: x["code"])

        return Response(
            {
                "success": True,
                "data": result,
                "summary": {
                    "total_debits": total_debits,
                    "total_credits": total_credits,
                    "is_balanced": total_debits == total_credits,
                },
            }
        )

    # ------------------------------------------------------------------
    # PROFIT & LOSS
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"])
    def profit_loss(self, request):
        """
        Profit & Loss computed from live transactional data.
        Income → confirmed RECEIPT payments (SALES account)
        Expenses → mapped via Expense records by category
        """
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        if not start_date or not end_date:
            return Response(
                {"success": False, "error": "start_date and end_date are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company_id, branch_id = get_company_branch(request)

        accounts = Account.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            account_type__in=["INCOME", "EXPENSE"],
            is_deleted=False,
        )

        income_accounts = []
        expense_accounts = []
        income_total = Decimal("0.00")
        expense_total = Decimal("0.00")

        for account in accounts:
            balance = compute_account_balance(
                company_id, branch_id, account,
                start_date=start_date, end_date=end_date,
            )
            item = {"code": account.code, "name": account.name, "amount": balance}
            if account.account_type == "INCOME":
                income_accounts.append(item)
                income_total += balance
            else:
                expense_accounts.append(item)
                expense_total += balance

        def aggregate_accounts(accounts_list):
            agg = {}
            for acc in accounts_list:
                key = f"{acc['code']}_{acc['name']}"
                if key in agg:
                    agg[key]["amount"] += acc["amount"]
                else:
                    agg[key] = acc.copy()
            return sorted(agg.values(), key=lambda x: x["code"])

        income_agg = aggregate_accounts(income_accounts)
        expense_agg = aggregate_accounts(expense_accounts)

        net_profit = income_total - expense_total
        is_profit = net_profit >= 0

        return Response(
            {
                "success": True,
                "period": {"start_date": start_date, "end_date": end_date},
                "income": {"total": income_total, "accounts": income_agg},
                "expenses": {"total": expense_total, "accounts": expense_agg},
                "net_profit": net_profit,
                "is_profit": is_profit,
            }
        )

    # ------------------------------------------------------------------
    # BALANCE SHEET
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"])
    def balance_sheet(self, request):
        """
        Balance Sheet computed from live transactional data.
        Assets = Liabilities + Equity
        """
        as_of_date = request.query_params.get("as_of_date")

        if not as_of_date:
            return Response(
                {"success": False, "error": "as_of_date is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company_id, branch_id = get_company_branch(request)

        accounts = Account.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            account_type__in=["ASSET", "LIABILITY", "EQUITY"],
            is_deleted=False,
        )

        assets = []
        liabilities = []
        equity = []

        for account in accounts:
            balance = compute_account_balance(
                company_id, branch_id, account, as_of_date=as_of_date,
            )
            item = {"code": account.code, "name": account.name, "balance": balance}
            if account.account_type == "ASSET":
                assets.append(item)
            elif account.account_type == "LIABILITY":
                liabilities.append(item)
            elif account.account_type == "EQUITY":
                equity.append(item)

        assets.sort(key=lambda x: x["code"])
        liabilities.sort(key=lambda x: x["code"])
        equity.sort(key=lambda x: x["code"])

        total_assets = sum(a["balance"] for a in assets)
        total_liabilities = sum(l["balance"] for l in liabilities)
        total_equity = sum(e["balance"] for e in equity)

        return Response(
            {
                "success": True,
                "as_of_date": as_of_date,
                "assets": {"accounts": assets, "total": total_assets},
                "liabilities": {"accounts": liabilities, "total": total_liabilities},
                "equity": {"accounts": equity, "total": total_equity},
                "is_balanced": total_assets == (total_liabilities + total_equity),
            }
        )

    # ------------------------------------------------------------------
    # AR AGING
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"])
    def ar_aging(self, request):
        """Accounts Receivable aging report (live from CustomerInvoice)"""
        company_id, branch_id = get_company_branch(request)
        today = timezone.now().date()
        invoices = CustomerInvoice.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            is_deleted=False,
        ).exclude(status="CANCELLED").select_related("customer")
        aging = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0}
        details = []
        for inv in invoices:
            outstanding = inv.outstanding
            if outstanding <= 0:
                continue
            days = (today - inv.due_date).days
            if days <= 0:
                aging["current"] += outstanding
                bucket = "current"
            elif days <= 30:
                aging["1_30"] += outstanding
                bucket = "1-30 days"
            elif days <= 60:
                aging["31_60"] += outstanding
                bucket = "31-60 days"
            elif days <= 90:
                aging["61_90"] += outstanding
                bucket = "61-90 days"
            else:
                aging["90_plus"] += outstanding
                bucket = "90+ days"
            details.append(
                {
                    "invoice_number": inv.invoice_number,
                    "customer": inv.customer.name,
                    "due_date": inv.due_date,
                    "outstanding": outstanding,
                    "bucket": bucket,
                }
            )
        return Response({"aging": aging, "details": details})

    # ------------------------------------------------------------------
    # AP AGING
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"])
    def ap_aging(self, request):
        """Accounts Payable aging report (live from SupplierBill)"""
        company_id, branch_id = get_company_branch(request)
        today = timezone.now().date()
        bills = SupplierBill.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            is_deleted=False,
        ).exclude(status="CANCELLED").select_related("supplier")
        aging = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0}
        details = []
        for bill in bills:
            outstanding = bill.outstanding
            if outstanding <= 0:
                continue
            days = (today - bill.due_date).days
            if days <= 0:
                aging["current"] += outstanding
                bucket = "current"
            elif days <= 30:
                aging["1_30"] += outstanding
                bucket = "1-30 days"
            elif days <= 60:
                aging["31_60"] += outstanding
                bucket = "31-60 days"
            elif days <= 90:
                aging["61_90"] += outstanding
                bucket = "61-90 days"
            else:
                aging["90_plus"] += outstanding
                bucket = "90+ days"
            details.append(
                {
                    "bill_number": bill.bill_number,
                    "supplier": bill.supplier.name,
                    "due_date": bill.due_date,
                    "outstanding": outstanding,
                    "bucket": bucket,
                }
            )
        return Response({"aging": aging, "details": details})

    # ------------------------------------------------------------------
    # EXPENSE REPORT
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"])
    def expense_report(self, request):
        """Expense breakdown by category (live from Expense model)"""
        company_id, branch_id = get_company_branch(request)
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        qs = Expense.objects.filter(
            company_id=company_id, branch_id=branch_id
        )
        if start_date:
            qs = qs.filter(expense_date__gte=start_date)
        if end_date:
            qs = qs.filter(expense_date__lte=end_date)
        by_category = (
            qs.values("category")
            .annotate(total=Sum("amount"))
            .order_by("-total")
        )
        return Response({"by_category": list(by_category)})
