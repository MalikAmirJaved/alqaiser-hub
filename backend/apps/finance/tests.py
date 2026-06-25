from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.finance.models import (
    Account, JournalEntry, JournalLine, BankAccount, BankTransaction,
    Expense, Budget, Payment,
)

User = get_user_model()


class AccountModelTest(TestCase):
    def test_create(self):
        a = Account.objects.create(
            code='1000', name='Cash', account_type='ASSET',
            company_id=1, branch_id=1
        )
        self.assertTrue(a.is_active)

    def test_account_type_choices(self):
        for at in ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']:
            a = Account.objects.create(
                code=f'TEST-{at}', name=at, account_type=at,
                company_id=1, branch_id=1
            )
            self.assertEqual(a.account_type, at)

    def test_unique_code(self):
        Account.objects.create(code='X', name='X', account_type='ASSET', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            Account.objects.create(code='X', name='Y', account_type='ASSET', company_id=1, branch_id=1)

    def test_parent_self_fk(self):
        parent = Account.objects.create(
            code='P', name='Parent', account_type='ASSET', company_id=1, branch_id=1
        )
        child = Account.objects.create(
            code='C', name='Child', account_type='ASSET', parent=parent,
            company_id=1, branch_id=1
        )
        self.assertEqual(child.parent, parent)


class JournalEntryTest(TestCase):
    def test_create(self):
        je = JournalEntry.objects.create(
            entry_number='JE-001', date=date.today(),
            description='Test entry', company_id=1, branch_id=1
        )
        self.assertTrue(je.is_posted)

    def test_unique_entry_number(self):
        JournalEntry.objects.create(
            entry_number='JE-002', date=date.today(), company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            JournalEntry.objects.create(
                entry_number='JE-002', date=date.today(), company_id=1, branch_id=1
            )


class JournalLineTest(TestCase):
    def setUp(self):
        self.je = JournalEntry.objects.create(
            entry_number='JE-010', date=date.today(), company_id=1, branch_id=1
        )
        self.account = Account.objects.create(
            code='1001', name='Cash', account_type='ASSET', company_id=1, branch_id=1
        )

    def test_create_debit(self):
        jl = JournalLine.objects.create(
            journal_entry=self.je, account=self.account,
            debit=Decimal('100.00'), credit=Decimal('0.00')
        )
        self.assertEqual(jl.debit, Decimal('100.00'))

    def test_create_credit(self):
        jl = JournalLine.objects.create(
            journal_entry=self.je, account=self.account,
            debit=Decimal('0.00'), credit=Decimal('50.00')
        )
        self.assertEqual(jl.credit, Decimal('50.00'))

    def test_defaults(self):
        jl = JournalLine.objects.create(
            journal_entry=self.je, account=self.account
        )
        self.assertEqual(jl.debit, Decimal('0.00'))
        self.assertEqual(jl.credit, Decimal('0.00'))


class BankAccountModelTest(TestCase):
    def test_create(self):
        ba = BankAccount.objects.create(
            account_name='Main Account', account_number='12345',
            bank_name='Test Bank', opening_balance=Decimal('10000.00'),
            company_id=1, branch_id=1
        )
        self.assertEqual(ba.book_balance, Decimal('10000.00'))
        self.assertEqual(ba.cleared_balance, Decimal('10000.00'))
        self.assertEqual(ba.currency, 'USD')

    def test_pending_balance(self):
        ba = BankAccount.objects.create(
            account_name='A', account_number='1', bank_name='B',
            opening_balance=Decimal('1000'), company_id=1, branch_id=1
        )
        ba.book_balance = Decimal('1500')
        ba.cleared_balance = Decimal('1000')
        ba.save()
        ba.refresh_from_db()
        self.assertEqual(ba.pending_balance, Decimal('500'))

    def test_save_initializes_balances(self):
        ba = BankAccount.objects.create(
            account_name='New', account_number='999', bank_name='Bank',
            opening_balance=Decimal('5000'), company_id=1, branch_id=1
        )
        self.assertEqual(ba.book_balance, Decimal('5000'))
        self.assertEqual(ba.cleared_balance, Decimal('5000'))


class BankTransactionTest(TestCase):
    def setUp(self):
        self.ba = BankAccount.objects.create(
            account_name='A', account_number='1', bank_name='B',
            opening_balance=Decimal('10000'), company_id=1, branch_id=1
        )

    def test_create(self):
        bt = BankTransaction.objects.create(
            bank_account=self.ba, transaction_date=date.today(),
            amount=Decimal('500'), transaction_type='DEPOSIT',
            company_id=1, branch_id=1
        )
        self.assertFalse(bt.reconciled)

    def test_apply_to_balance_deposit(self):
        bt = BankTransaction.objects.create(
            bank_account=self.ba, transaction_date=date.today(),
            amount=Decimal('1000'), transaction_type='DEPOSIT',
            company_id=1, branch_id=1
        )
        new_balance = bt.apply_to_balance(Decimal('5000'))
        self.assertEqual(new_balance, Decimal('6000'))

    def test_apply_to_balance_withdrawal(self):
        bt = BankTransaction.objects.create(
            bank_account=self.ba, transaction_date=date.today(),
            amount=Decimal('300'), transaction_type='WITHDRAWAL',
            company_id=1, branch_id=1
        )
        new_balance = bt.apply_to_balance(Decimal('5000'))
        self.assertEqual(new_balance, Decimal('4700'))

    def test_apply_to_balance_interest(self):
        bt = BankTransaction.objects.create(
            bank_account=self.ba, transaction_date=date.today(),
            amount=Decimal('50'), transaction_type='INTEREST',
            company_id=1, branch_id=1
        )
        new_balance = bt.apply_to_balance(Decimal('5000'))
        self.assertEqual(new_balance, Decimal('5050'))

    def test_apply_to_balance_fee(self):
        bt = BankTransaction.objects.create(
            bank_account=self.ba, transaction_date=date.today(),
            amount=Decimal('25'), transaction_type='FEE',
            company_id=1, branch_id=1
        )
        new_balance = bt.apply_to_balance(Decimal('5000'))
        self.assertEqual(new_balance, Decimal('4975'))


class ExpenseTest(TestCase):
    def test_create(self):
        e = Expense.objects.create(
            expense_number='EXP-001', category='RENT',
            expense_date=date.today(), amount=Decimal('2000'),
            description='Monthly rent', company_id=1, branch_id=1
        )
        self.assertEqual(e.category, 'RENT')

    def test_category_choices(self):
        for cat in ['RENT', 'UTILITIES', 'SALARIES', 'OFFICE_SUPPLIES', 'TRAVEL']:
            e = Expense.objects.create(
                expense_number=f'EXP-{cat}', category=cat,
                expense_date=date.today(), amount=Decimal('100'),
                description='Test', company_id=1, branch_id=1
            )
            self.assertEqual(e.category, cat)


class BudgetTest(TestCase):
    def setUp(self):
        self.account = Account.objects.create(
            code='5001', name='Rent', account_type='EXPENSE',
            company_id=1, branch_id=1
        )

    def test_create(self):
        b = Budget.objects.create(
            account=self.account, period_type='MONTHLY',
            year=2025, month=6, amount=Decimal('5000'),
            company_id=1, branch_id=1
        )
        self.assertEqual(b.year, 2025)
        self.assertEqual(b.month, 6)

    def test_period_type_choices(self):
        for pt in ['MONTHLY', 'QUARTERLY', 'YEARLY']:
            b = Budget.objects.create(
                account=self.account, period_type=pt,
                year=2025, amount=Decimal('10000'),
                company_id=1, branch_id=1
            )
            self.assertEqual(b.period_type, pt)


class PaymentTest(TestCase):
    def test_create(self):
        p = Payment.objects.create(
            payment_type='RECEIPT', amount=Decimal('5000'),
            payment_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(p.payment_type, 'RECEIPT')
        self.assertEqual(p.status, 'DRAFT')

    def test_payment_type_choices(self):
        for pt in ['RECEIPT', 'PAYMENT']:
            p = Payment.objects.create(
                payment_type=pt, amount=Decimal('100'),
                payment_date=date.today(), company_id=1, branch_id=1
            )
            self.assertEqual(p.payment_type, pt)

    def test_payment_method_default(self):
        p = Payment.objects.create(
            payment_type='PAYMENT', amount=Decimal('100'),
            payment_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(p.payment_method, 'BANK_TRANSFER')
