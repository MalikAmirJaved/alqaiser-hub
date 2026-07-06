from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.finance.models import (
    Account, JournalEntry, JournalLine, BankAccount, BankTransaction,
    Expense, Budget, Payment, CustomerInvoice, CustomerInvoiceLine,
    SupplierBill, InvoiceLineProductLink,
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

    def test_description_field(self):
        a = Account.objects.create(
            code='DESC', name='Desc Account', account_type='ASSET',
            description='Main cash account', company_id=1, branch_id=1
        )
        self.assertEqual(a.description, 'Main cash account')

    def test_str_representation(self):
        a = Account.objects.create(code='1001', name='Petty Cash', account_type='ASSET', company_id=1, branch_id=1)
        self.assertEqual(str(a), '1001 - Petty Cash')


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

    def test_reference_fields(self):
        import uuid
        je = JournalEntry.objects.create(
            entry_number='JE-REF', date=date.today(),
            reference_type='INVOICE', reference_id=uuid.uuid4(),
            company_id=1, branch_id=1
        )
        self.assertEqual(je.reference_type, 'INVOICE')
        self.assertIsNotNone(je.reference_id)

    def test_description_blank(self):
        je = JournalEntry.objects.create(
            entry_number='JE-BLANK', date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(je.description, '')

    def test_str_representation(self):
        je = JournalEntry.objects.create(
            entry_number='JE-STR', date=date.today(), company_id=1, branch_id=1
        )
        self.assertIn('JE-STR', str(je))


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

    def test_inventory_transaction_id(self):
        import uuid
        jl = JournalLine.objects.create(
            journal_entry=self.je, account=self.account,
            inventory_transaction_id=uuid.uuid4()
        )
        self.assertIsNotNone(jl.inventory_transaction_id)

    def test_str_representation(self):
        jl = JournalLine.objects.create(
            journal_entry=self.je, account=self.account,
            debit=Decimal('100.00')
        )
        self.assertIn('JE-010', str(jl))
        self.assertIn('DR', str(jl))


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

    def test_is_active_default(self):
        ba = BankAccount.objects.create(
            account_name='Act', account_number='ACT1', bank_name='B',
            company_id=1, branch_id=1
        )
        self.assertTrue(ba.is_active)

    def test_currency_default(self):
        ba = BankAccount.objects.create(
            account_name='Cur', account_number='CUR1', bank_name='B',
            company_id=1, branch_id=1
        )
        self.assertEqual(ba.currency, 'USD')

    def test_str_representation(self):
        ba = BankAccount.objects.create(
            account_name='Main', account_number='M1', bank_name='HBL',
            company_id=1, branch_id=1
        )
        self.assertIn('HBL', str(ba))
        self.assertIn('Main', str(ba))


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

    def test_description_and_reference(self):
        bt = BankTransaction.objects.create(
            bank_account=self.ba, transaction_date=date.today(),
            amount=Decimal('100'), transaction_type='DEPOSIT',
            description='Wire transfer', reference='REF-001',
            company_id=1, branch_id=1
        )
        self.assertEqual(bt.description, 'Wire transfer')
        self.assertEqual(bt.reference, 'REF-001')


class ExpenseTest(TestCase):
    def test_create(self):
        e = Expense.objects.create(
            expense_number='EXP-001', category='RENT',
            expense_date=date.today(), amount=Decimal('2000'),
            description='Monthly rent', company_id=1, branch_id=1
        )
        self.assertEqual(e.category, 'RENT')

    def test_category_choices(self):
        for cat in ['RENT', 'UTILITIES', 'SALARIES', 'OFFICE_SUPPLIES', 'TRAVEL',
                     'MARKETING', 'SOFTWARE', 'MAINTENANCE', 'INSURANCE', 'TAXES', 'OTHER',
                     'STAFF_LOAN', 'EXIT_SETTLEMENT']:
            e = Expense.objects.create(
                expense_number=f'EXP-{cat}', category=cat,
                expense_date=date.today(), amount=Decimal('100'),
                description='Test', company_id=1, branch_id=1
            )
            self.assertEqual(e.category, cat)

    def test_notes_field(self):
        e = Expense.objects.create(
            expense_number='EXP-NOTES', category='RENT',
            expense_date=date.today(), amount=Decimal('100'),
            description='Test', notes='Additional notes',
            company_id=1, branch_id=1
        )
        self.assertEqual(e.notes, 'Additional notes')

    def test_str_representation(self):
        e = Expense.objects.create(
            expense_number='EXP-STR', category='RENT',
            expense_date=date.today(), amount=Decimal('500'),
            description='Test', company_id=1, branch_id=1
        )
        self.assertIn('EXP-STR', str(e))


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

    def test_quarter_field(self):
        b = Budget.objects.create(
            account=self.account, period_type='QUARTERLY',
            year=2025, quarter=2, amount=Decimal('15000'),
            company_id=1, branch_id=1
        )
        self.assertEqual(b.quarter, 2)

    def test_notes_field(self):
        b = Budget.objects.create(
            account=self.account, period_type='MONTHLY',
            year=2025, month=1, amount=Decimal('5000'),
            notes='Q1 budget', company_id=1, branch_id=1
        )
        self.assertEqual(b.notes, 'Q1 budget')


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

    def test_payment_method_choices(self):
        for pm in ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD', 'WALLET', 'OTHER']:
            p = Payment.objects.create(
                payment_type='PAYMENT', amount=Decimal('100'),
                payment_date=date.today(), payment_method=pm,
                company_id=1, branch_id=1
            )
            self.assertEqual(p.payment_method, pm)

    def test_status_choices(self):
        for s in ['DRAFT', 'CONFIRMED', 'CANCELLED']:
            p = Payment.objects.create(
                payment_type='PAYMENT', amount=Decimal('100'),
                payment_date=date.today(), status=s,
                company_id=1, branch_id=1
            )
            self.assertEqual(p.status, s)

    def test_reference_number(self):
        p = Payment.objects.create(
            payment_type='RECEIPT', amount=Decimal('100'),
            payment_date=date.today(), reference_number='REF-123',
            company_id=1, branch_id=1
        )
        self.assertEqual(p.reference_number, 'REF-123')

    def test_notes_field(self):
        p = Payment.objects.create(
            payment_type='PAYMENT', amount=Decimal('100'),
            payment_date=date.today(), notes='Monthly payment',
            company_id=1, branch_id=1
        )
        self.assertEqual(p.notes, 'Monthly payment')


class CustomerInvoiceTest(TestCase):
    def setUp(self):
        from apps.inventory.models import Customer
        self.customer = Customer.objects.create(
            name='Cust', customer_code='CI01', company_id=1, branch_id=1
        )

    def test_create(self):
        inv = CustomerInvoice.objects.create(
            invoice_number='INV-001', customer=self.customer,
            invoice_date=date.today(), amount=Decimal('5000'),
            company_id=1, branch_id=1
        )
        self.assertEqual(inv.status, 'PENDING')
        self.assertEqual(inv.payment_method, 'CREDIT')
        self.assertEqual(inv.source, 'FINANCE')

    def test_status_choices(self):
        for s in ['PENDING', 'SENT', 'DRAFT', 'CANCELLED']:
            inv = CustomerInvoice.objects.create(
                invoice_number=f'INV-{s}', customer=self.customer,
                invoice_date=date.today(), amount=Decimal('100'),
                status=s, company_id=1, branch_id=1
            )
            self.assertEqual(inv.status, s)

    def test_payment_method_choices(self):
        for pm in ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD', 'CREDIT', 'OTHER']:
            inv = CustomerInvoice.objects.create(
                invoice_number=f'INV-{pm}', customer=self.customer,
                invoice_date=date.today(), amount=Decimal('100'),
                payment_method=pm, company_id=1, branch_id=1
            )
            self.assertEqual(inv.payment_method, pm)

    def test_source_choices(self):
        for src in ['FINANCE', 'SALES_POS', 'SALES_AGENT', 'SALES_QUOTE']:
            inv = CustomerInvoice.objects.create(
                invoice_number=f'INV-{src}', customer=self.customer,
                invoice_date=date.today(), amount=Decimal('100'),
                source=src, company_id=1, branch_id=1
            )
            self.assertEqual(inv.source, src)

    def test_unique_invoice_number(self):
        CustomerInvoice.objects.create(
            invoice_number='INV-UNIQ', customer=self.customer,
            invoice_date=date.today(), amount=Decimal('100'),
            company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            CustomerInvoice.objects.create(
                invoice_number='INV-UNIQ', customer=self.customer,
                invoice_date=date.today(), amount=Decimal('100'),
                company_id=1, branch_id=1
            )

    def test_overall_discount_and_tax(self):
        inv = CustomerInvoice.objects.create(
            invoice_number='INV-DT', customer=self.customer,
            invoice_date=date.today(), amount=Decimal('1000'),
            overall_discount_percent=Decimal('10.00'),
            overall_tax_percent=Decimal('15.00'),
            company_id=1, branch_id=1
        )
        self.assertEqual(inv.overall_discount_percent, Decimal('10.00'))
        self.assertEqual(inv.overall_tax_percent, Decimal('15.00'))

    def test_due_date(self):
        inv = CustomerInvoice.objects.create(
            invoice_number='INV-DD', customer=self.customer,
            invoice_date=date.today(), due_date=date.today() + timedelta(days=30),
            amount=Decimal('100'), company_id=1, branch_id=1
        )
        self.assertIsNotNone(inv.due_date)

    def test_notes_field(self):
        inv = CustomerInvoice.objects.create(
            invoice_number='INV-NOTES', customer=self.customer,
            invoice_date=date.today(), amount=Decimal('100'),
            notes='Net 30 terms', company_id=1, branch_id=1
        )
        self.assertEqual(inv.notes, 'Net 30 terms')


class CustomerInvoiceLineTest(TestCase):
    def setUp(self):
        from apps.inventory.models import Customer, Product, ProductVariant
        self.customer = Customer.objects.create(
            name='C', customer_code='CIL01', company_id=1, branch_id=1
        )
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='CIL-V1', company_id=1, branch_id=1
        )
        self.invoice = CustomerInvoice.objects.create(
            invoice_number='INV-LINE', customer=self.customer,
            invoice_date=date.today(), amount=Decimal('500'),
            company_id=1, branch_id=1
        )

    def test_create(self):
        line = CustomerInvoiceLine.objects.create(
            customer_invoice=self.invoice, variant=self.variant,
            quantity=10, unit_price=Decimal('50.00'),
            company_id=1, branch_id=1
        )
        self.assertEqual(line.status, 'ACTIVE')
        self.assertFalse(line.is_manual_entry)

    def test_line_total(self):
        line = CustomerInvoiceLine.objects.create(
            customer_invoice=self.invoice, variant=self.variant,
            quantity=5, unit_price=Decimal('100.00'),
            discount_amount=Decimal('25.00'),
            company_id=1, branch_id=1
        )
        self.assertEqual(line.subtotal, Decimal('500.00'))
        self.assertEqual(line.line_total, Decimal('475.00'))

    def test_manual_entry(self):
        line = CustomerInvoiceLine.objects.create(
            customer_invoice=self.invoice, variant=None,
            is_manual_entry=True, manual_variant_name='Service Fee',
            manual_variant_sku='SVC-001',
            quantity=1, unit_price=Decimal('200.00'),
            company_id=1, branch_id=1
        )
        self.assertTrue(line.is_manual_entry)
        self.assertEqual(line.manual_variant_name, 'Service Fee')

    def test_status_choices(self):
        for s in ['ACTIVE', 'CANCELLED', 'RETURNED']:
            line = CustomerInvoiceLine.objects.create(
                customer_invoice=self.invoice, variant=self.variant,
                quantity=1, unit_price=Decimal('10.00'),
                status=s, company_id=1, branch_id=1
            )
            self.assertEqual(line.status, s)

    def test_resolved_field(self):
        line = CustomerInvoiceLine.objects.create(
            customer_invoice=self.invoice, variant=self.variant,
            quantity=1, unit_price=Decimal('10.00'),
            company_id=1, branch_id=1
        )
        self.assertFalse(line.resolved)


class SupplierBillTest(TestCase):
    def setUp(self):
        from apps.inventory.models import Supplier
        self.supplier = Supplier.objects.create(
            name='Sup', code='SB01', company_id=1, branch_id=1
        )

    def test_create(self):
        bill = SupplierBill.objects.create(
            bill_number='BILL-001', supplier=self.supplier,
            bill_date=date.today(), due_date=date.today() + timedelta(days=30),
            amount=Decimal('3000'), company_id=1, branch_id=1
        )
        self.assertEqual(bill.status, 'DRAFT')

    def test_status_choices(self):
        for s in ['DRAFT', 'CANCELLED']:
            bill = SupplierBill.objects.create(
                bill_number=f'BILL-{s}', supplier=self.supplier,
                bill_date=date.today(), due_date=date.today(),
                amount=Decimal('100'), status=s, company_id=1, branch_id=1
            )
            self.assertEqual(bill.status, s)

    def test_unique_bill_number(self):
        SupplierBill.objects.create(
            bill_number='BILL-UNIQ', supplier=self.supplier,
            bill_date=date.today(), due_date=date.today(),
            amount=Decimal('100'), company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            SupplierBill.objects.create(
                bill_number='BILL-UNIQ', supplier=self.supplier,
                bill_date=date.today(), due_date=date.today(),
                amount=Decimal('100'), company_id=1, branch_id=1
            )

    def test_notes_field(self):
        bill = SupplierBill.objects.create(
            bill_number='BILL-NOTES', supplier=self.supplier,
            bill_date=date.today(), due_date=date.today(),
            amount=Decimal('100'), notes='Urgent payment',
            company_id=1, branch_id=1
        )
        self.assertEqual(bill.notes, 'Urgent payment')


class InvoiceLineProductLinkTest(TestCase):
    def setUp(self):
        from apps.inventory.models import Customer, Product, ProductVariant
        self.customer = Customer.objects.create(
            name='C', customer_code='ILP01', company_id=1, branch_id=1
        )
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='ILP-V1', company_id=1, branch_id=1
        )
        self.invoice = CustomerInvoice.objects.create(
            invoice_number='INV-ILP', customer=self.customer,
            invoice_date=date.today(), amount=Decimal('100'),
            company_id=1, branch_id=1
        )
        self.invoice_line = CustomerInvoiceLine.objects.create(
            customer_invoice=self.invoice, variant=self.variant,
            quantity=1, unit_price=Decimal('100.00'),
            is_manual_entry=True, company_id=1, branch_id=1
        )

    def test_create(self):
        link = InvoiceLineProductLink.objects.create(
            invoice_line=self.invoice_line,
            product=self.product, variant=self.variant,
            company_id=1, branch_id=1
        )
        self.assertEqual(link.invoice_line, self.invoice_line)

    def test_unique_together(self):
        InvoiceLineProductLink.objects.create(
            invoice_line=self.invoice_line,
            product=self.product, variant=self.variant,
            company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            InvoiceLineProductLink.objects.create(
                invoice_line=self.invoice_line,
                product=self.product, variant=self.variant,
                company_id=1, branch_id=1
            )
