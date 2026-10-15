"""Regression tests: per-line tax must be included in stored document totals.

Bug: PurchaseOrder/Quote/CustomerInvoice/SalesOrder totals summed only the
net line amounts (qty * price - discount) and silently dropped each line's
tax_rate, so the saved total never matched what the forms displayed.

See docs/bugfoundresolved.md BUG-20261010-11.
"""
from datetime import date
from decimal import Decimal

from django.test import TestCase

from apps.common.totals import dec, document_total, line_amount_with_tax, line_net, line_tax


class TotalsHelperTest(TestCase):
    """Pure-math tests for the shared calculation helpers."""

    def test_dec_coercion(self):
        self.assertEqual(dec('12.50'), Decimal('12.50'))
        self.assertEqual(dec(None), Decimal('0'))
        self.assertEqual(dec(''), Decimal('0'))
        self.assertEqual(dec(3), Decimal('3'))

    def test_line_tax_applies_rate_before_line_discount(self):
        # 10 x 100.00 with 15% tax = 150.00
        self.assertEqual(
            line_tax(10, Decimal('100.00'), Decimal('15.00')),
            Decimal('150.00'),
        )
        self.assertEqual(line_tax(2, Decimal('50.00')), Decimal('0'))

    def test_line_net(self):
        self.assertEqual(
            line_net(4, Decimal('25.00'), Decimal('10.00')),
            Decimal('90.00'),
        )

    def test_line_amount_adds_tax_before_subtracting_discount(self):
        self.assertEqual(
            line_amount_with_tax(
                1, Decimal('280.00'), Decimal('50.00'), Decimal('20.00')
            ),
            Decimal('400.00'),
        )

    def test_document_total_without_any_tax_matches_old_behaviour(self):
        # 1000 subtotal - 50 line discount - 100 overall(10%) = 850
        self.assertEqual(
            document_total(
                Decimal('1000'), Decimal('50'), Decimal('0'),
                Decimal('10'), Decimal('0'),
            ),
            Decimal('850'),
        )

    def test_document_total_includes_line_tax(self):
        # subtotal 1000, no discounts, line tax 150, no overall tax -> 1150
        self.assertEqual(
            document_total(Decimal('1000'), Decimal('0'), Decimal('150')),
            Decimal('1150'),
        )

    def test_document_total_full_stack(self):
        # subtotal 1000
        # + line tax 60
        # + overall tax 5% of 1000 = 50 -> tax-inclusive amount 1110
        # - overall discount 10% of 1110 = 111
        # - line discounts 100
        # -> 899
        self.assertEqual(
            document_total(
                Decimal('1000'), Decimal('100'), Decimal('60'),
                Decimal('10'), Decimal('5'),
            ),
            Decimal('899'),
        )

    def test_document_total_applies_tax_before_line_discount(self):
        self.assertEqual(
            document_total(
                Decimal('280'), Decimal('20'), Decimal('140'),
            ),
            Decimal('400'),
        )

    def test_line_total_properties_include_tax(self):
        from apps.inventory.models import (
            PurchaseOrder, PurchaseOrderLine, Product, ProductVariant, Supplier,
        )
        from apps.organization.models import Company, Branch
        from apps.sales.models.quote import Quote, QuoteLine

        company = Company.objects.create(
            name='LT-Co', short_name='LTC', city='C', country='C', email='lt@t.com'
        )
        branch = Branch.objects.create(
            company=company, name='HO', code='LTH', city='C', country='C', email='lh@t.com'
        )
        supplier = Supplier.objects.create(
            name='LT-Sup', code='LT-S1', company_id=company.id, branch_id=branch.id
        )
        product = Product.objects.create(
            product_name='LT-Prod', company_id=company.id, branch_id=branch.id
        )
        variant = ProductVariant.objects.create(
            product=product, sku='LT-SKU-1', company_id=company.id, branch_id=branch.id
        )
        po = PurchaseOrder.objects.create(
            order_number='PO-LT-1', supplier=supplier,
            company_id=company.id, branch_id=branch.id
        )
        po_line = PurchaseOrderLine.objects.create(
            purchase_order=po, variant=variant,
            quantity_ordered=4, unit_cost=Decimal('25.00'),
            tax_rate=Decimal('10.00'), company_id=company.id, branch_id=branch.id
        )
        # 100.00 net + 10.00 tax
        self.assertEqual(po_line.line_total, Decimal('110.00'))

        quote = Quote.objects.create(
            quote_number='QT-LT-1', date=date.today(),
            company_id=company.id, branch_id=branch.id,
        )
        quote_line = QuoteLine.objects.create(
            quote=quote, quantity=2, unit_price=Decimal('50.00'),
            tax_rate=Decimal('5.00'), company_id=company.id, branch_id=branch.id,
        )
        # 100.00 net + 5.00 tax
        self.assertEqual(quote_line.line_total, Decimal('105.00'))


class DocumentTotalRegressionTest(TestCase):
    """End-to-end: the number we persist must equal subtotal + line tax.

    Each case mirrors the arithmetic the UI renders for that document.
    """

    @classmethod
    def setUpTestData(cls):
        from apps.organization.models import Company, Branch
        cls.company = Company.objects.create(
            name='TotCo', short_name='TC', city='Lahore',
            country='Pakistan', email='tot@company.com'
        )
        cls.branch = Branch.objects.create(
            company=cls.company, name='Head Office', code='TQ01',
            city='Lahore', country='Pakistan', email='hq@tot.com', is_hq=True
        )

    def _make_user(self, username):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        return User.objects.create_user(
            username=username, email=f'{username}@t.com', password='pass',
            company=self.company, branch=self.branch,
        )

    def test_purchase_order_total_adds_line_tax(self):
        from apps.inventory.serializers.purchase import PurchaseOrderSerializer
        from apps.inventory.models import Supplier, Product, ProductVariant

        user = self._make_user('po-total')
        supplier = Supplier.objects.create(
            name='Tot-Sup', code='TOT-S', company_id=self.company.id, branch_id=self.branch.id
        )
        product = Product.objects.create(
            product_name='TotProd', company_id=self.company.id, branch_id=self.branch.id
        )
        variant = ProductVariant.objects.create(
            product=product, sku='TOT-SKU-1',
            company_id=self.company.id, branch_id=self.branch.id
        )

        serializer = PurchaseOrderSerializer(
            data={
                'supplier': str(supplier._id),
                'line_items': [{
                    'variant': str(variant._id),
                    'quantity_ordered': 4,
                    'unit_cost': '25.00',
                    'tax_rate': '10.00',
                }],
            },
            context={'request': type('R', (), {'user': user})()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        po = serializer.save()

        # 4 x 25.00 = 100.00 net, + 10% tax = 10.00 -> 110.00
        self.assertEqual(po.total_amount, Decimal('110.00'))
        # the row total must reconcile with the header total
        self.assertEqual(
            sum(l.line_total for l in po.lines.all()),
            po.total_amount,
        )

    def test_quote_total_adds_line_tax(self):
        from apps.sales.serializers.quote import QuoteSerializer

        user = self._make_user('qt-total')
        serializer = QuoteSerializer(
            data={
                'date': str(date.today()),
                'overall_tax_percent': '0',
                'lines': [{
                    'quantity': 2,
                    'unit_price': '100.00',
                    'tax_rate': '15.00',
                    'discount_amount': '0',
                    'is_manual_entry': True,
                    'manual_variant_name': 'Manual item',
                }],
            },
            context={'request': type('R', (), {'user': user})()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        quote = serializer.save()

        # 200.00 net + 15% = 30.00 -> 230.00
        self.assertEqual(quote.total_amount, Decimal('230.00'))

    def test_quote_total_adds_line_tax_and_overall_tax(self):
        from apps.sales.serializers.quote import QuoteSerializer

        user = self._make_user('qt-total2')
        serializer = QuoteSerializer(
            data={
                'date': str(date.today()),
                'overall_discount_percent': '10',
                'overall_tax_percent': '5',
                'lines': [{
                    'quantity': 10,
                    'unit_price': '100.00',
                    'tax_rate': '15.00',
                    'discount_amount': '0',
                    'is_manual_entry': True,
                    'manual_variant_name': 'Manual item',
                }],
            },
            context={'request': type('R', (), {'user': user})()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        quote = serializer.save()

        # 1000 + line tax 150 + overall tax 50 = 1200, less 10% discount = 1080
        self.assertEqual(quote.total_amount, Decimal('1080.00'))

    def test_quote_total_applies_tax_before_line_discount(self):
        from apps.sales.serializers.quote import QuoteSerializer

        user = self._make_user('qt-tax-first')
        serializer = QuoteSerializer(
            data={
                'date': str(date.today()),
                'overall_tax_percent': '0',
                'lines': [{
                    'quantity': 1,
                    'unit_price': '280.00',
                    'tax_rate': '50.00',
                    'discount_amount': '20.00',
                    'is_manual_entry': True,
                    'manual_variant_name': 'Manual item',
                }],
            },
            context={'request': type('R', (), {'user': user})()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        quote = serializer.save()
        self.assertEqual(quote.total_amount, Decimal('400.00'))


    def test_customer_invoice_total_applies_tax_before_line_discount(self):
        from apps.finance.serializers.customer_invoice import CustomerInvoiceSerializer
        from apps.inventory.models import Product, ProductVariant

        user = self._make_user('inv-total')
        product = Product.objects.create(
            product_name='InvProd', company_id=self.company.id, branch_id=self.branch.id
        )
        variant = ProductVariant.objects.create(
            product=product, sku='INV-SKU-1',
            company_id=self.company.id, branch_id=self.branch.id
        )
        serializer = CustomerInvoiceSerializer(
            data={
                'invoice_number': 'INV-TAX-1',
                'invoice_date': str(date.today()),
                'overall_tax_percent': '0',
                'lines': [{
                    'variant': str(variant._id),
                    'quantity': 1,
                    'unit_price': '280.00',
                    'tax_rate': '50.00',
                    'discount_amount': '20.00',
                    'is_manual_entry': False,
                }],
            },
            context={'request': type('R', (), {'user': user})()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        invoice = serializer.save()

        # 280.00 + 50% tax 140.00 - line discount 20.00 = 400.00
        self.assertEqual(invoice.amount, Decimal('400.00'))

    def test_quote_update_recalculates_total_with_tax(self):
        from apps.sales.serializers.quote import QuoteSerializer
        from apps.sales.models.quote import Quote

        user = self._make_user('qt-upd')
        quote = Quote.objects.create(
            quote_number='QT-UPD-1', date=date.today(),
            company_id=self.company.id, branch_id=self.branch.id, created_by=user,
        )
        serializer = QuoteSerializer(
            quote,
            data={
                'date': str(date.today()),
                'overall_tax_percent': '0',
                'lines': [{
                    'quantity': 1,
                    'unit_price': '500.00',
                    'tax_rate': '20.00',
                    'discount_amount': '0',
                    'is_manual_entry': True,
                    'manual_variant_name': 'Manual item',
                }],
            },
            context={'request': type('R', (), {'user': user})()},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()

        # 500.00 + 20% = 100.00 -> 600.00
        self.assertEqual(updated.total_amount, Decimal('600.00'))

    def test_sales_order_total_adds_line_tax(self):
        from apps.inventory.serializers.sales import SalesOrderSerializer
        from apps.inventory.models import Product, ProductVariant, Warehouse

        user = self._make_user('so-total')
        product = Product.objects.create(
            product_name='SOProd', company_id=self.company.id, branch_id=self.branch.id
        )
        variant = ProductVariant.objects.create(
            product=product, sku='SO-SKU-1',
            company_id=self.company.id, branch_id=self.branch.id
        )
        warehouse = Warehouse.objects.create(
            warehouse_name='SO-WH', code='SO-WH1', country='C', city='C',
            company_id=self.company.id, branch_id=self.branch.id
        )
        serializer = SalesOrderSerializer(
            data={
                'warehouse': str(warehouse._id),
                'order_date': str(date.today()),
                'line_items': [{
                    'variant': str(variant._id),
                    'quantity_ordered': 2,
                    'unit_price': 150.00,
                    'tax_rate': 10.00,
                }],
            },
            context={'request': type('R', (), {'user': user})()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        order = serializer.save()

        # 300.00 net + 10% = 30.00 -> 330.00
        self.assertEqual(order.total_amount, Decimal('330.00'))
