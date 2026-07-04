from datetime import date
from decimal import Decimal
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
