from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.organization.models import Company, Branch
from apps.sales.models import Lead, Quote, QuoteLine

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
        for src in ['MANUAL', 'FACEBOOK', 'WHATSAPP', 'WEBSITE', 'REFERRAL', 'OTHER']:
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
