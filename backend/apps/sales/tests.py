from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.exceptions import ValidationError
from apps.organization.models import Company, Branch
from apps.sales.models import Lead, Quote, QuoteLine, SalesStatusHistory

User = get_user_model()


class LeadModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(
            name='Co', short_name='CO', city='C', country='C', email='co@t.com'
        )
        cls.branch = Branch.objects.create(
            company=cls.company, name='HO', code='HQ', city='C', country='C', email='ho@t.com'
        )
        cls.user = User.objects.create_user(
            username='sls', email='sls@t.com', password='pass',
            company=cls.company, branch=cls.branch
        )

    def test_create(self):
        lead = Lead.objects.create(
            first_name='John', last_name='Doe', email='john@test.com',
            source='WEBSITE', company_id=self.company.id, branch_id=self.branch.id,
            created_by=self.user, updated_by=self.user
        )
        self.assertEqual(lead.status, 'NEW')
        self.assertEqual(lead.source, 'WEBSITE')

    def test_status_choices(self):
        for s in ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'CONVERTED', 'LOST']:
            lead = Lead.objects.create(
                first_name='F', last_name='L', status=s,
                company_id=self.company.id, branch_id=self.branch.id
            )
            self.assertEqual(lead.status, s)

    def test_source_choices(self):
        for src in ['MANUAL', 'FACEBOOK', 'WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'REFERRAL', 'OTHER']:
            lead = Lead.objects.create(
                first_name='F', last_name='L', source=src,
                company_id=self.company.id, branch_id=self.branch.id
            )
            self.assertEqual(lead.source, src)

    def test_defaults(self):
        lead = Lead.objects.create(
            first_name='A', company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(lead.source, 'MANUAL')
        self.assertEqual(lead.status, 'NEW')

    def test_lost_reason_choices(self):
        for reason in ['TOO_EXPENSIVE', 'COMPETITOR_SELECTED', 'NO_RESPONSE', 'OTHER']:
            lead = Lead.objects.create(
                first_name='F', company_id=self.company.id, branch_id=self.branch.id,
                status='LOST', lost_reason=reason
            )
            self.assertEqual(lead.lost_reason, reason)

    def test_priority_choices(self):
        for priority in ['HOT', 'WARM', 'COLD']:
            lead = Lead.objects.create(
                first_name='P', company_id=self.company.id, branch_id=self.branch.id,
                priority=priority
            )
            self.assertEqual(lead.priority, priority)

    def test_priority_default_empty(self):
        lead = Lead.objects.create(
            first_name='P', company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(lead.priority, '')

    def test_score_validation_valid(self):
        lead = Lead.objects.create(
            first_name='S', company_id=self.company.id, branch_id=self.branch.id,
            score=50
        )
        self.assertEqual(lead.score, 50)

    def test_score_validation_null(self):
        lead = Lead.objects.create(
            first_name='S', company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertIsNone(lead.score)

    def test_follow_up_fields(self):
        lead = Lead.objects.create(
            first_name='F', company_id=self.company.id, branch_id=self.branch.id,
            follow_up_date=date(2025, 8, 1), follow_up_notes='Call back'
        )
        self.assertEqual(lead.follow_up_date, date(2025, 8, 1))
        self.assertEqual(lead.follow_up_notes, 'Call back')

    def test_address_fields(self):
        lead = Lead.objects.create(
            first_name='A', company_id=self.company.id, branch_id=self.branch.id,
            address_line='123 Main St', country='Pakistan', state='Punjab', city='Lahore'
        )
        self.assertEqual(lead.country, 'Pakistan')
        self.assertEqual(lead.city, 'Lahore')

    def test_company_name_field(self):
        lead = Lead.objects.create(
            first_name='C', company_id=self.company.id, branch_id=self.branch.id,
            company_name='Acme Corp'
        )
        self.assertEqual(lead.company_name, 'Acme Corp')

    def test_notes_field(self):
        lead = Lead.objects.create(
            first_name='N', company_id=self.company.id, branch_id=self.branch.id,
            notes='Important lead'
        )
        self.assertEqual(lead.notes, 'Important lead')

    def test_str_with_name(self):
        lead = Lead.objects.create(
            first_name='John', last_name='Doe', company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(str(lead), 'John Doe')

    def test_str_with_company_name(self):
        lead = Lead.objects.create(
            first_name='A', company_id=self.company.id, branch_id=self.branch.id,
            company_name='Acme'
        )
        self.assertEqual(str(lead), 'A')


class QuoteModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(
            name='QCo', short_name='QCO', city='C', country='C', email='qco@t.com'
        )
        cls.branch = Branch.objects.create(
            company=cls.company, name='HO', code='HQ', city='C', country='C', email='qho@t.com'
        )
        cls.user = User.objects.create_user(
            username='quser', email='quser@t.com', password='pass',
            company=cls.company, branch=cls.branch
        )

    def test_create(self):
        quote = Quote.objects.create(
            quote_number='QT-001', date=date.today(),
            company_id=self.company.id, branch_id=self.branch.id,
            created_by=self.user
        )
        self.assertEqual(quote.status, 'DRAFT')
        self.assertEqual(quote.total_amount, Decimal('0.00'))

    def test_status_choices(self):
        for s in ['DRAFT', 'SENT', 'VIEWED', 'APPROVED', 'REJECTED', 'CONVERTED']:
            quote = Quote.objects.create(
                quote_number=f'QT-{s}', date=date.today(),
                status=s, company_id=self.company.id, branch_id=self.branch.id
            )
            self.assertEqual(quote.status, s)

    def test_unique_quote_number(self):
        Quote.objects.create(
            quote_number='QT-UNIQ', date=date.today(),
            company_id=self.company.id, branch_id=self.branch.id
        )
        with self.assertRaises(Exception):
            Quote.objects.create(
                quote_number='QT-UNIQ', date=date.today(),
                company_id=self.company.id, branch_id=self.branch.id
            )

    def test_quote_serializer_preserves_user_supplied_quote_number(self):
        from apps.sales.serializers.quote import QuoteSerializer

        serializer = QuoteSerializer(
            data={'quote_number': 'CUSTOM-Q-100', 'date': date.today()},
            context={'request': SimpleNamespace(user=self.user)},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        quote = serializer.save()
        self.assertEqual(quote.quote_number, 'CUSTOM-Q-100')

        update_serializer = QuoteSerializer(
            quote,
            data={'quote_number': 'CUSTOM-Q-100'},
            partial=True,
            context={'request': SimpleNamespace(user=self.user)},
        )
        self.assertTrue(update_serializer.is_valid(), update_serializer.errors)
        self.assertEqual(update_serializer.save().quote_number, 'CUSTOM-Q-100')

    def test_quote_serializer_rejects_duplicate_user_supplied_quote_number(self):
        from apps.sales.serializers.quote import QuoteSerializer

        Quote.objects.create(
            quote_number='CUSTOM-Q-DUPLICATE',
            date=date.today(),
            company_id=self.company.id,
            branch_id=self.branch.id,
        )
        serializer = QuoteSerializer(
            data={'quote_number': 'CUSTOM-Q-DUPLICATE', 'date': date.today()},
            context={'request': SimpleNamespace(user=self.user)},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('quote_number', serializer.errors)

    def test_sales_invoice_create_preserves_user_supplied_invoice_number(self):
        from apps.sales.views.invoice import SalesInvoiceViewSet

        view = SalesInvoiceViewSet()
        view.request = SimpleNamespace(
            user=SimpleNamespace(company_id=1, branch_id=1)
        )
        serializer = Mock(validated_data={'invoice_number': 'CUSTOM-INV-200'})

        view.perform_create(serializer)

        self.assertEqual(
            serializer.save.call_args.kwargs['invoice_number'],
            'CUSTOM-INV-200',
        )

    def test_pending_sales_invoice_can_be_updated(self):
        from apps.sales.views.invoice import SalesInvoiceViewSet

        view = SalesInvoiceViewSet()
        view.request = SimpleNamespace(user=self.user)
        serializer = Mock(
            instance=SimpleNamespace(status='PENDING', payment_status='UNPAID')
        )

        view.perform_update(serializer)

        serializer.save.assert_called_once_with(
            updated_by=self.user,
            status='PENDING',
        )

    def test_sent_sales_invoice_can_be_updated_without_changing_status(self):
        from apps.sales.views.invoice import SalesInvoiceViewSet

        view = SalesInvoiceViewSet()
        view.request = SimpleNamespace(user=self.user)
        serializer = Mock(
            instance=SimpleNamespace(status='SENT', payment_status='UNPAID')
        )

        view.perform_update(serializer)

        serializer.save.assert_called_once_with(
            updated_by=self.user,
            status='SENT',
        )

    def test_sales_invoice_update_passes_existing_line_ids_to_serializer(self):
        from unittest.mock import patch
        from apps.sales.views.invoice import SalesInvoiceViewSet

        line_id = '271eba80-bbb4-4477-8c2a-c91d36fb3aab'
        invoice = SimpleNamespace(
            _id='0baf1e5a-119c-4fd3-a7df-e2601fb8ae99',
            company_id=self.company.id,
            branch_id=self.branch.id,
            status='PENDING',
            payment_status='UNPAID',
            lines=SimpleNamespace(all=Mock()),
        )
        serializer = Mock(instance=invoice, data={})
        serializer.data = {}
        view = SalesInvoiceViewSet()
        view.request = SimpleNamespace(
            user=self.user,
            data={'template_slug': 'classic', 'lines': [{'id': line_id, 'quantity': 7}]},
        )
        view.get_object = Mock(return_value=invoice)
        view.get_serializer_context = Mock(return_value={})
        view.get_serializer = Mock(return_value=serializer)

        with (
            patch('apps.sales.views.invoice.direct_release_stock'),
            patch('apps.sales.views.invoice.direct_deduct_stock'),
        ):
            view.update(view.request)

        self.assertEqual(
            view.get_serializer.call_args.kwargs['context']['raw_line_ids'],
            {0: line_id},
        )

    def test_revising_sales_invoice_quantity_reconciles_stock_across_updates(self):
        from apps.finance.models import CustomerInvoice, CustomerInvoiceLine
        from apps.inventory.models import (
            InventoryTransaction,
            Product,
            ProductVariant,
            StockItem,
            Warehouse,
        )
        from apps.inventory.services.stock_service import (
            direct_deduct_stock,
            direct_release_stock,
        )

        product = Product.objects.create(
            product_name='Bottle',
            company_id=self.company.id,
            branch_id=self.branch.id,
        )
        variant = ProductVariant.objects.create(
            product=product,
            sku='BOTTLE-STOCK-TEST',
            company_id=self.company.id,
            branch_id=self.branch.id,
        )
        warehouse = Warehouse.objects.create(
            warehouse_name='Main',
            code='MAIN-STOCK-TEST',
            country='Pakistan',
            city='Lahore',
            company_id=self.company.id,
            branch_id=self.branch.id,
        )
        stock = StockItem.objects.create(
            variant=variant,
            warehouse=warehouse,
            quantity_on_hand=15,
            company_id=self.company.id,
            branch_id=self.branch.id,
        )
        invoice = CustomerInvoice.objects.create(
            invoice_number='INV-STOCK-RECONCILE',
            invoice_date=date.today(),
            amount=Decimal('100'),
            source='SALES_AGENT',
            company_id=self.company.id,
            branch_id=self.branch.id,
            created_by=self.user,
            updated_by=self.user,
        )
        line = CustomerInvoiceLine.objects.create(
            customer_invoice=invoice,
            variant=variant,
            quantity=10,
            unit_price=Decimal('10'),
            company_id=self.company.id,
            branch_id=self.branch.id,
            created_by=self.user,
            updated_by=self.user,
        )
        direct_deduct_stock(
            invoice.lines.all(), self.company.id, self.branch.id, invoice._id, self.user
        )
        stock.refresh_from_db()
        self.assertEqual(stock.quantity_on_hand, 5)

        direct_release_stock(invoice._id, self.company.id, self.user)
        line.quantity = 15
        line.save(update_fields=['quantity'])
        direct_deduct_stock(
            invoice.lines.all(), self.company.id, self.branch.id, invoice._id, self.user
        )
        stock.refresh_from_db()
        self.assertEqual(stock.quantity_on_hand, 0)

        direct_release_stock(invoice._id, self.company.id, self.user)
        line.quantity = 12
        line.save(update_fields=['quantity'])
        direct_deduct_stock(
            invoice.lines.all(), self.company.id, self.branch.id, invoice._id, self.user
        )
        stock.refresh_from_db()
        self.assertEqual(stock.quantity_on_hand, 3)

        # A second update with the same quantity must not replay old deductions.
        direct_release_stock(invoice._id, self.company.id, self.user)
        direct_deduct_stock(
            invoice.lines.all(), self.company.id, self.branch.id, invoice._id, self.user
        )
        stock.refresh_from_db()
        self.assertEqual(stock.quantity_on_hand, 3)

        invoice_transactions = InventoryTransaction.objects.filter(
            source_document_id=invoice._id,
            source_document_type__in=(
                'CUSTOMER_INVOICE',
                'CUSTOMER_INVOICE_REVERSAL',
            ),
        )
        self.assertEqual(
            sum(txn.quantity_change for txn in invoice_transactions),
            -12,
        )

    def test_source_default(self):
        quote = Quote.objects.create(
            quote_number='QT-SRC', date=date.today(),
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(quote.source, 'SALES_DESKTOP')

    def test_source_choices(self):
        for src in ['SALES_DESKTOP', 'SALES_POS', 'SALES_AGENT']:
            quote = Quote.objects.create(
                quote_number=f'QT-{src}', date=date.today(),
                source=src, company_id=self.company.id, branch_id=self.branch.id
            )
            self.assertEqual(quote.source, src)

    def test_overall_discount_percent(self):
        quote = Quote.objects.create(
            quote_number='QT-DISC', date=date.today(),
            overall_discount_percent=Decimal('10.00'),
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(quote.overall_discount_percent, Decimal('10.00'))

    def test_overall_tax_percent(self):
        quote = Quote.objects.create(
            quote_number='QT-TAX', date=date.today(),
            overall_tax_percent=Decimal('15.00'),
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(quote.overall_tax_percent, Decimal('15.00'))

    def test_expiration_date(self):
        quote = Quote.objects.create(
            quote_number='QT-EXP', date=date.today(),
            expiration_date=date(2025, 12, 31),
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(quote.expiration_date, date(2025, 12, 31))

    def test_notes_field(self):
        quote = Quote.objects.create(
            quote_number='QT-NOTES', date=date.today(),
            notes='Special terms apply',
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(quote.notes, 'Special terms apply')


class QuoteLineModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        from apps.inventory.models import Product, ProductVariant
        cls.company = Company.objects.create(
            name='QLCo', short_name='QLCO', city='C', country='C', email='qlco@t.com'
        )
        cls.branch = Branch.objects.create(
            company=cls.company, name='HO', code='HQ', city='C', country='C', email='qlho@t.com'
        )
        cls.product = Product.objects.create(
            product_name='P', company_id=cls.company.id, branch_id=cls.branch.id
        )
        cls.variant = ProductVariant.objects.create(
            product=cls.product, sku='QV1',
            company_id=cls.company.id, branch_id=cls.branch.id
        )
        cls.quote = Quote.objects.create(
            quote_number='QT-LINE', date=date.today(),
            company_id=cls.company.id, branch_id=cls.branch.id
        )

    def test_subtotal(self):
        line = QuoteLine.objects.create(
            quote=self.quote, variant=self.variant,
            quantity=10, unit_price=Decimal('25.00'),
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(line.subtotal, Decimal('250.00'))

    def test_line_total_with_discount(self):
        line = QuoteLine.objects.create(
            quote=self.quote, variant=self.variant,
            quantity=5, unit_price=Decimal('100.00'),
            discount_amount=Decimal('50.00'),
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(line.line_total, Decimal('450.00'))

    def test_line_total_no_discount(self):
        line = QuoteLine.objects.create(
            quote=self.quote, variant=self.variant,
            quantity=3, unit_price=Decimal('33.33'),
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(line.line_total, Decimal('99.99'))

    def test_defaults(self):
        line = QuoteLine.objects.create(
            quote=self.quote, variant=self.variant,
            quantity=1, unit_price=Decimal('10.00'),
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(line.tax_rate, Decimal('0.00'))
        self.assertEqual(line.discount_amount, Decimal('0.00'))

    def test_is_manual_entry(self):
        line = QuoteLine.objects.create(
            quote=self.quote, variant=self.variant,
            quantity=1, unit_price=Decimal('10.00'),
            is_manual_entry=True, manual_variant_name='Custom Item',
            manual_variant_sku='CUSTOM-001',
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertTrue(line.is_manual_entry)
        self.assertEqual(line.manual_variant_name, 'Custom Item')
        self.assertEqual(line.manual_variant_sku, 'CUSTOM-001')

    def test_description_field(self):
        line = QuoteLine.objects.create(
            quote=self.quote, variant=self.variant,
            quantity=1, unit_price=Decimal('10.00'),
            description='Extra description',
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(line.description, 'Extra description')

    def test_tax_rate(self):
        line = QuoteLine.objects.create(
            quote=self.quote, variant=self.variant,
            quantity=1, unit_price=Decimal('100.00'),
            tax_rate=Decimal('15.00'),
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(line.tax_rate, Decimal('15.00'))


class SalesStatusHistoryTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(
            name='SHCo', short_name='SHCO', city='C', country='C', email='shco@t.com'
        )
        cls.branch = Branch.objects.create(
            company=cls.company, name='HO', code='HQ', city='C', country='C', email='shho@t.com'
        )
        cls.user = User.objects.create_user(
            username='shuser', email='shuser@t.com', password='pass',
            company=cls.company, branch=cls.branch
        )

    def test_create_lead_status(self):
        import uuid
        sh = SalesStatusHistory.objects.create(
            entity_type='LEAD', entity_id=uuid.uuid4(),
            from_status='NEW', to_status='CONTACTED',
            changed_by=self.user,
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(sh.entity_type, 'LEAD')
        self.assertEqual(sh.from_status, 'NEW')
        self.assertEqual(sh.to_status, 'CONTACTED')

    def test_create_quote_status(self):
        import uuid
        sh = SalesStatusHistory.objects.create(
            entity_type='QUOTE', entity_id=uuid.uuid4(),
            from_status='DRAFT', to_status='SENT',
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(sh.entity_type, 'QUOTE')

    def test_entity_type_choices(self):
        import uuid
        for et in ['LEAD', 'QUOTE']:
            sh = SalesStatusHistory.objects.create(
                entity_type=et, entity_id=uuid.uuid4(),
                to_status='TEST',
                company_id=self.company.id, branch_id=self.branch.id
            )
            self.assertEqual(sh.entity_type, et)

    def test_notes_field(self):
        import uuid
        sh = SalesStatusHistory.objects.create(
            entity_type='LEAD', entity_id=uuid.uuid4(),
            to_status='QUALIFIED', notes='Converted after call',
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertEqual(sh.notes, 'Converted after call')

    def test_str_representation(self):
        import uuid
        eid = uuid.uuid4()
        sh = SalesStatusHistory.objects.create(
            entity_type='LEAD', entity_id=eid,
            from_status='NEW', to_status='CONTACTED',
            company_id=self.company.id, branch_id=self.branch.id
        )
        self.assertIn('LEAD', str(sh))
        self.assertIn('CONTACTED', str(sh))
