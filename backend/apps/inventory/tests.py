import uuid
from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.inventory.models import (
    Category, Brand, Warehouse, Product, ProductVariant,
    StockItem, InventoryTransaction, Supplier, SupplierHistory,
    Customer, PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine,
    SalesOrder, SalesOrderLine, SalesReturn, SalesReturnLine,
    StockTransfer, StockReservation, ReturnRefund, ReturnRefundLine,
    Alert, VariantAttribute, VariantImage,
)

User = get_user_model()


class CategoryTest(TestCase):
    def test_create(self):
        c = Category.objects.create(name='Electronics', code='EL01', company_id=1, branch_id=1)
        self.assertEqual(c.name, 'Electronics')

    def test_unique_together(self):
        Category.objects.create(name='A', code='X', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            Category.objects.create(name='B', code='X', company_id=1, branch_id=1)

    def test_different_company_same_code(self):
        Category.objects.create(name='A', code='X', company_id=1, branch_id=1)
        c = Category.objects.create(name='B', code='X', company_id=2, branch_id=2)
        self.assertIsNotNone(c._id)

    def test_description_blank(self):
        c = Category.objects.create(name='C', code='CD', company_id=1, branch_id=1)
        self.assertEqual(c.description, '')


class BrandTest(TestCase):
    def test_create(self):
        b = Brand.objects.create(name='Samsung', code='SAM', company_id=1, branch_id=1)
        self.assertEqual(b.name, 'Samsung')

    def test_unique_together(self):
        Brand.objects.create(name='A', code='X', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            Brand.objects.create(name='B', code='X', company_id=1, branch_id=1)

    def test_country_of_origin(self):
        b = Brand.objects.create(name='LG', code='LG', country_of_origin='South Korea', company_id=1, branch_id=1)
        self.assertEqual(b.country_of_origin, 'South Korea')


class WarehouseTest(TestCase):
    def test_create(self):
        w = Warehouse.objects.create(
            warehouse_name='Main WH', code='WH01', country='Pakistan',
            city='Lahore', company_id=1, branch_id=1
        )
        self.assertTrue(w.is_active)

    def test_unique_together(self):
        Warehouse.objects.create(
            warehouse_name='A', code='W1', country='C', city='C',
            company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            Warehouse.objects.create(
                warehouse_name='B', code='W1', country='C', city='C',
                company_id=1, branch_id=1
            )

    def test_new_fields(self):
        w = Warehouse.objects.create(
            warehouse_name='New WH', code='WH2', country='Pakistan',
            city='Karachi', state='Sindh', address_line='123 Industrial Area',
            postal_code='75500', email='wh@test.com',
            landline_number='021-1234567', description='Main warehouse',
            company_id=1, branch_id=1
        )
        self.assertEqual(w.landline_number, '021-1234567')
        self.assertEqual(w.description, 'Main warehouse')
        self.assertEqual(w.state, 'Sindh')


class ProductTest(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name='Cat', code='CAT', company_id=1, branch_id=1)
        self.brand = Brand.objects.create(name='Brand', code='BR', company_id=1, branch_id=1)

    def test_create(self):
        p = Product.objects.create(
            product_name='Widget', category=self.category, brand=self.brand,
            company_id=1, branch_id=1
        )
        self.assertEqual(p.status, 'draft')
        self.assertTrue(p.is_active)

    def test_unit_choices(self):
        for unit in ['PIECE', 'KG', 'GRAM', 'LITER', 'ML', 'PACK', 'DOZEN']:
            p = Product.objects.create(
                product_name=f'P-{unit}', unit=unit,
                company_id=1, branch_id=1
            )
            self.assertEqual(p.unit, unit)

    def test_storage_requirement_choices(self):
        for sr in ['AMBIENT', 'REFRIGERATED', 'FROZEN']:
            p = Product.objects.create(
                product_name=f'P-{sr}', storage_requirement=sr,
                company_id=1, branch_id=1
            )
            self.assertEqual(p.storage_requirement, sr)

    def test_tax_rate(self):
        p = Product.objects.create(
            product_name='Taxed', tax_rate=Decimal('15.00'),
            company_id=1, branch_id=1
        )
        self.assertEqual(p.tax_rate, Decimal('15.00'))

    def test_description(self):
        p = Product.objects.create(
            product_name='Desc', description='A test product',
            company_id=1, branch_id=1
        )
        self.assertEqual(p.description, 'A test product')

    def test_status_choices(self):
        for s in ['draft', 'active', 'discontinued', 'archived']:
            p = Product.objects.create(
                product_name=f'P-{s}', status=s,
                company_id=1, branch_id=1
            )
            self.assertEqual(p.status, s)


class ProductVariantTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            product_name='Widget', company_id=1, branch_id=1
        )

    def test_create(self):
        v = ProductVariant.objects.create(
            product=self.product, sku='SKU001',
            selling_price=Decimal('29.99'), company_id=1, branch_id=1
        )
        self.assertEqual(v.sku, 'SKU001')
        self.assertEqual(v.selling_price, Decimal('29.99'))

    def test_unique_together(self):
        ProductVariant.objects.create(
            product=self.product, sku='SKU002', company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            ProductVariant.objects.create(
                product=self.product, sku='SKU002', company_id=1, branch_id=1
            )

    def test_defaults(self):
        v = ProductVariant.objects.create(
            product=self.product, sku='SKU003', company_id=1, branch_id=1
        )
        self.assertEqual(v.buying_price, 0)
        self.assertEqual(v.selling_price, 0)
        self.assertEqual(v.min_stock_level, 0)
        self.assertEqual(v.max_stock_level, 0)

    def test_barcode_and_qr(self):
        v = ProductVariant.objects.create(
            product=self.product, sku='SKU004',
            barcode='BC123456', qr_code='QR789',
            variant_title='Blue XL',
            company_id=1, branch_id=1
        )
        self.assertEqual(v.barcode, 'BC123456')
        self.assertEqual(v.qr_code, 'QR789')
        self.assertEqual(v.variant_title, 'Blue XL')


class StockItemTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='S1', company_id=1, branch_id=1
        )
        self.warehouse = Warehouse.objects.create(
            warehouse_name='WH', code='WH1', country='C', city='C',
            company_id=1, branch_id=1
        )

    def test_create(self):
        si = StockItem.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            quantity_on_hand=100, quantity_reserved=10, company_id=1, branch_id=1
        )
        self.assertEqual(si.quantity_available, 90)

    def test_quantity_available(self):
        si = StockItem.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            quantity_on_hand=50, quantity_reserved=20, company_id=1, branch_id=1
        )
        self.assertEqual(si.quantity_available, 30)

    def test_unique_together(self):
        StockItem.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            StockItem.objects.create(
                variant=self.variant, warehouse=self.warehouse,
                company_id=1, branch_id=1
            )

    def test_version_default(self):
        si = StockItem.objects.create(
            variant=self.variant, warehouse=self.warehouse, company_id=1, branch_id=1
        )
        self.assertEqual(si.version, 0)

    def test_bin_location(self):
        si = StockItem.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            bin_location='A1-B2', company_id=1, branch_id=1
        )
        self.assertEqual(si.bin_location, 'A1-B2')


class InventoryTransactionTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='T1', company_id=1, branch_id=1
        )
        self.warehouse = Warehouse.objects.create(
            warehouse_name='WH', code='WH1', country='C', city='C',
            company_id=1, branch_id=1
        )

    def test_create(self):
        t = InventoryTransaction.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            quantity_change=10, quantity_before=0, quantity_after=10,
            transaction_type='PURCHASE_RECEIPT', transaction_id=uuid.uuid4(),
            company_id=1, branch_id=1
        )
        self.assertEqual(t.quantity_change, 10)

    def test_transaction_type_choices(self):
        for tt in ['PURCHASE_RECEIPT', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT',
                    'DAMAGE', 'ADD_STOCK', 'TRANSFER_IN', 'TRANSFER_OUT', 'STOCK_TAKE', 'INITIAL']:
            t = InventoryTransaction.objects.create(
                variant=self.variant, warehouse=self.warehouse,
                quantity_change=1, quantity_before=0, quantity_after=1,
                transaction_type=tt, transaction_id=uuid.uuid4(),
                company_id=1, branch_id=1
            )
            self.assertEqual(t.transaction_type, tt)

    def test_unit_cost(self):
        t = InventoryTransaction.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            quantity_change=10, quantity_before=0, quantity_after=10,
            transaction_type='PURCHASE_RECEIPT', transaction_id=uuid.uuid4(),
            unit_cost=Decimal('25.50'), company_id=1, branch_id=1
        )
        self.assertEqual(t.unit_cost, Decimal('25.50'))

    def test_source_document_fields(self):
        t = InventoryTransaction.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            quantity_change=1, quantity_before=0, quantity_after=1,
            transaction_type='SALE', transaction_id=uuid.uuid4(),
            source_document_type='sales_order', source_document_id=uuid.uuid4(),
            source_line_id=uuid.uuid4(), company_id=1, branch_id=1
        )
        self.assertEqual(t.source_document_type, 'sales_order')
        self.assertIsNotNone(t.source_document_id)

    def test_reason_fields(self):
        t = InventoryTransaction.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            quantity_change=-5, quantity_before=10, quantity_after=5,
            transaction_type='ADJUSTMENT', transaction_id=uuid.uuid4(),
            reason_code='DAMAGED', reason_text='Water damage',
            company_id=1, branch_id=1
        )
        self.assertEqual(t.reason_code, 'DAMAGED')
        self.assertEqual(t.reason_text, 'Water damage')


class SupplierTest(TestCase):
    def test_create(self):
        s = Supplier.objects.create(
            name='Acme Supply', code='SUP01', company_id=1, branch_id=1
        )
        self.assertEqual(s.partner_type, 'supplier')
        self.assertEqual(s.status, 'active')

    def test_unique_together(self):
        Supplier.objects.create(name='A', code='X', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            Supplier.objects.create(name='B', code='X', company_id=1, branch_id=1)

    def test_balance_and_credit(self):
        s = Supplier.objects.create(
            name='Bal', code='BAL01', balance=Decimal('5000'), credit=Decimal('1000'),
            company_id=1, branch_id=1
        )
        self.assertEqual(s.balance, Decimal('5000'))
        self.assertEqual(s.credit, Decimal('1000'))

    def test_contact_fields(self):
        s = Supplier.objects.create(
            name='Contact', code='CON01',
            contact_person='Ali', email='ali@test.com', phone='0300-1234567',
            address_line='123 Main', country='Pakistan', city='Lahore',
            company_id=1, branch_id=1
        )
        self.assertEqual(s.contact_person, 'Ali')
        self.assertEqual(s.email, 'ali@test.com')

    def test_status_choices(self):
        for st in ['active', 'inactive', 'suspended']:
            s = Supplier.objects.create(
                name=f'S-{st}', code=f'S{st[:3]}', status=st,
                company_id=1, branch_id=1
            )
            self.assertEqual(s.status, st)

    def test_str_representation(self):
        s = Supplier.objects.create(name='Acme', code='ACM', company_id=1, branch_id=1)
        self.assertIn('ACM', str(s))


class SupplierHistoryTest(TestCase):
    def setUp(self):
        self.supplier = Supplier.objects.create(
            name='Sup', code='SH01', company_id=1, branch_id=1
        )

    def test_create(self):
        sh = SupplierHistory.objects.create(
            supplier=self.supplier, transaction_type='PURCHASE',
            amount=Decimal('5000'), balance_after=Decimal('5000'),
            company_id=1, branch_id=1
        )
        self.assertEqual(sh.transaction_type, 'PURCHASE')
        self.assertEqual(sh.balance_after, Decimal('5000'))

    def test_transaction_type_choices(self):
        for tt in ['PURCHASE', 'PURCHASE_REVERSAL', 'PAYMENT', 'CREDIT_NOTE',
                    'INVOICE_ADJUSTMENT', 'CREDIT_APPLIED']:
            sh = SupplierHistory.objects.create(
                supplier=self.supplier, transaction_type=tt,
                amount=Decimal('100'), company_id=1, branch_id=1
            )
            self.assertEqual(sh.transaction_type, tt)

    def test_reference_fields(self):
        sh = SupplierHistory.objects.create(
            supplier=self.supplier, transaction_type='PAYMENT',
            amount=Decimal('1000'), reference_type='payment',
            reference_id=uuid.uuid4(), company_id=1, branch_id=1
        )
        self.assertEqual(sh.reference_type, 'payment')
        self.assertIsNotNone(sh.reference_id)


class CustomerTest(TestCase):
    def test_create(self):
        c = Customer.objects.create(
            name='John Corp', customer_code='CUST01', company_id=1, branch_id=1
        )
        self.assertTrue(c.is_active)

    def test_unique_together(self):
        Customer.objects.create(name='A', customer_code='X', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            Customer.objects.create(name='B', customer_code='X', company_id=1, branch_id=1)

    def test_contact_fields(self):
        c = Customer.objects.create(
            name='Contact', customer_code='CC01',
            contact_person='Sara', email='sara@test.com', phone='0321-1234567',
            address_line='456 Market', city='Karachi', state='Sindh',
            postal_code='75500', country='Pakistan',
            company_id=1, branch_id=1
        )
        self.assertEqual(c.contact_person, 'Sara')
        self.assertEqual(c.email, 'sara@test.com')
        self.assertEqual(c.country, 'Pakistan')


class PurchaseOrderTest(TestCase):
    def setUp(self):
        self.supplier = Supplier.objects.create(
            name='Sup', code='S1', company_id=1, branch_id=1
        )
        self.warehouse = Warehouse.objects.create(
            warehouse_name='WH', code='WH1', country='C', city='C',
            company_id=1, branch_id=1
        )

    def test_create(self):
        po = PurchaseOrder.objects.create(
            order_number='PO-001', supplier=self.supplier,
            warehouse=self.warehouse, company_id=1, branch_id=1
        )
        self.assertEqual(po.status, 'DRAFT')
        self.assertEqual(po.total_amount, 0)

    def test_order_number_unique(self):
        PurchaseOrder.objects.create(
            order_number='PO-002', supplier=self.supplier, company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            PurchaseOrder.objects.create(
                order_number='PO-002', supplier=self.supplier, company_id=1, branch_id=1
            )

    def test_inventory_type_choices(self):
        for it in ['FOR_SALE', 'OFFICE_INVENTORY']:
            po = PurchaseOrder.objects.create(
                order_number=f'PO-{it}', supplier=self.supplier,
                inventory_type=it, company_id=1, branch_id=1
            )
            self.assertEqual(po.inventory_type, it)

    def test_order_date_and_expected_delivery(self):
        po = PurchaseOrder.objects.create(
            order_number='PO-DATE', supplier=self.supplier,
            order_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=14),
            company_id=1, branch_id=1
        )
        self.assertEqual(po.order_date, date.today())
        self.assertIsNotNone(po.expected_delivery_date)

    def test_notes_field(self):
        po = PurchaseOrder.objects.create(
            order_number='PO-NOTES', supplier=self.supplier,
            notes='Urgent order', company_id=1, branch_id=1
        )
        self.assertEqual(po.notes, 'Urgent order')


class PurchaseOrderLineTest(TestCase):
    def setUp(self):
        self.supplier = Supplier.objects.create(name='S', code='S', company_id=1, branch_id=1)
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='V1', company_id=1, branch_id=1
        )
        self.po = PurchaseOrder.objects.create(
            order_number='PO-003', supplier=self.supplier, company_id=1, branch_id=1
        )

    def test_create(self):
        line = PurchaseOrderLine.objects.create(
            purchase_order=self.po, variant=self.variant,
            quantity_ordered=100, unit_cost=Decimal('5.00'),
            company_id=1, branch_id=1
        )
        self.assertEqual(line.status, 'PENDING')

    def test_line_total(self):
        line = PurchaseOrderLine.objects.create(
            purchase_order=self.po, variant=self.variant,
            quantity_ordered=10, unit_cost=Decimal('25.50'),
            company_id=1, branch_id=1
        )
        self.assertEqual(line.line_total, Decimal('255.00'))

    def test_quantity_received(self):
        line = PurchaseOrderLine.objects.create(
            purchase_order=self.po, variant=self.variant,
            quantity_ordered=100, quantity_received=50,
            unit_cost=Decimal('5.00'), company_id=1, branch_id=1
        )
        self.assertEqual(line.quantity_received, 50)

    def test_tax_rate(self):
        line = PurchaseOrderLine.objects.create(
            purchase_order=self.po, variant=self.variant,
            quantity_ordered=10, unit_cost=Decimal('100.00'),
            tax_rate=Decimal('15.00'), company_id=1, branch_id=1
        )
        self.assertEqual(line.tax_rate, Decimal('15.00'))

    def test_status_choices(self):
        for s in ['PENDING', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED']:
            line = PurchaseOrderLine.objects.create(
                purchase_order=self.po, variant=self.variant,
                quantity_ordered=1, unit_cost=Decimal('10.00'),
                status=s, company_id=1, branch_id=1
            )
            self.assertEqual(line.status, s)

    def test_notes_field(self):
        line = PurchaseOrderLine.objects.create(
            purchase_order=self.po, variant=self.variant,
            quantity_ordered=1, unit_cost=Decimal('10.00'),
            notes='Check quality', company_id=1, branch_id=1
        )
        self.assertEqual(line.notes, 'Check quality')


class GoodsReceiptTest(TestCase):
    def setUp(self):
        self.supplier = Supplier.objects.create(name='S', code='GRS', company_id=1, branch_id=1)
        self.po = PurchaseOrder.objects.create(
            order_number='PO-GR', supplier=self.supplier, company_id=1, branch_id=1
        )

    def test_create(self):
        gr = GoodsReceipt.objects.create(
            receipt_number='GR-001', purchase_order=self.po,
            received_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(gr.status, 'COMPLETED')

    def test_unique_receipt_number(self):
        GoodsReceipt.objects.create(
            receipt_number='GR-UNIQ', purchase_order=self.po,
            received_date=date.today(), company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            GoodsReceipt.objects.create(
                receipt_number='GR-UNIQ', purchase_order=self.po,
                received_date=date.today(), company_id=1, branch_id=1
            )

    def test_status_choices(self):
        for s in ['COMPLETED', 'PARTIALLY_RETURNED']:
            gr = GoodsReceipt.objects.create(
                receipt_number=f'GR-{s[:3]}', purchase_order=self.po,
                received_date=date.today(), status=s, company_id=1, branch_id=1
            )
            self.assertEqual(gr.status, s)


class GoodsReceiptLineTest(TestCase):
    def setUp(self):
        self.supplier = Supplier.objects.create(name='S', code='GRL', company_id=1, branch_id=1)
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='GRLV1', company_id=1, branch_id=1
        )
        self.po = PurchaseOrder.objects.create(
            order_number='PO-GRL', supplier=self.supplier, company_id=1, branch_id=1
        )
        self.po_line = PurchaseOrderLine.objects.create(
            purchase_order=self.po, variant=self.variant,
            quantity_ordered=100, unit_cost=Decimal('5.00'), company_id=1, branch_id=1
        )
        self.gr = GoodsReceipt.objects.create(
            receipt_number='GR-LINE', purchase_order=self.po,
            received_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        line = GoodsReceiptLine.objects.create(
            goods_receipt=self.gr, purchase_order_line=self.po_line,
            quantity_received=50, unit_cost=Decimal('5.00'),
            company_id=1, branch_id=1
        )
        self.assertTrue(line.accepted)


class SalesOrderTest(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(
            name='Cust', customer_code='C1', company_id=1, branch_id=1
        )
        self.warehouse = Warehouse.objects.create(
            warehouse_name='WH', code='WH1', country='C', city='C',
            company_id=1, branch_id=1
        )

    def test_create(self):
        so = SalesOrder.objects.create(
            order_number='SO-001', customer=self.customer,
            warehouse=self.warehouse, company_id=1, branch_id=1
        )
        self.assertEqual(so.status, 'PENDING')

    def test_order_number_unique(self):
        SalesOrder.objects.create(
            order_number='SO-002', customer=self.customer,
            warehouse=self.warehouse, company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            SalesOrder.objects.create(
                order_number='SO-002', customer=self.customer,
                warehouse=self.warehouse, company_id=1, branch_id=1
            )

    def test_payment_method_choices(self):
        for pm in ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD', 'CREDIT', 'OTHER']:
            so = SalesOrder.objects.create(
                order_number=f'SO-{pm}', warehouse=self.warehouse,
                payment_method=pm, company_id=1, branch_id=1
            )
            self.assertEqual(so.payment_method, pm)

    def test_source_choices(self):
        for src in ['INVENTORY', 'SALES_POS', 'SALES_AGENT', 'SALES_QUOTE']:
            so = SalesOrder.objects.create(
                order_number=f'SO-{src}', warehouse=self.warehouse,
                source=src, company_id=1, branch_id=1
            )
            self.assertEqual(so.source, src)

    def test_total_amount(self):
        so = SalesOrder.objects.create(
            order_number='SO-TOTAL', warehouse=self.warehouse,
            total_amount=Decimal('5000'), company_id=1, branch_id=1
        )
        self.assertEqual(so.total_amount, Decimal('5000'))


class SalesOrderLineTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='SV1', company_id=1, branch_id=1
        )
        self.customer = Customer.objects.create(
            name='C', customer_code='C1', company_id=1, branch_id=1
        )
        self.wh = Warehouse.objects.create(
            warehouse_name='WH', code='WH1', country='C', city='C',
            company_id=1, branch_id=1
        )
        self.so = SalesOrder.objects.create(
            order_number='SO-003', customer=self.customer,
            warehouse=self.wh, company_id=1, branch_id=1
        )

    def test_line_total(self):
        line = SalesOrderLine.objects.create(
            sales_order=self.so, variant=self.variant,
            quantity_ordered=5, unit_price=Decimal('100.00'),
            discount_amount=Decimal('25.00'), company_id=1, branch_id=1
        )
        self.assertEqual(line.subtotal, Decimal('500.00'))
        self.assertEqual(line.line_total, Decimal('475.00'))

    def test_defaults(self):
        line = SalesOrderLine.objects.create(
            sales_order=self.so, variant=self.variant,
            quantity_ordered=1, unit_price=Decimal('10.00'),
            company_id=1, branch_id=1
        )
        self.assertEqual(line.quantity_returned, 0)
        self.assertEqual(line.tax_rate, 0)
        self.assertEqual(line.discount_amount, 0)

    def test_discount_percent(self):
        line = SalesOrderLine.objects.create(
            sales_order=self.so, variant=self.variant,
            quantity_ordered=10, unit_price=Decimal('100.00'),
            discount_percent=Decimal('10.00'), company_id=1, branch_id=1
        )
        self.assertEqual(line.discount, Decimal('100.00'))
        self.assertEqual(line.line_total, Decimal('900.00'))

    def test_max_returnable(self):
        line = SalesOrderLine.objects.create(
            sales_order=self.so, variant=self.variant,
            quantity_ordered=10, unit_price=Decimal('10.00'),
            quantity_returned=3, company_id=1, branch_id=1
        )
        self.assertEqual(line.max_returnable, 7)

    def test_max_returnable_cancelled(self):
        line = SalesOrderLine.objects.create(
            sales_order=self.so, variant=self.variant,
            quantity_ordered=10, unit_price=Decimal('10.00'),
            status='CANCELLED', company_id=1, branch_id=1
        )
        self.assertEqual(line.max_returnable, 0)

    def test_status_choices(self):
        for s in ['PENDING', 'COMPLETE', 'CANCELLED']:
            line = SalesOrderLine.objects.create(
                sales_order=self.so, variant=self.variant,
                quantity_ordered=1, unit_price=Decimal('10.00'),
                status=s, company_id=1, branch_id=1
            )
            self.assertEqual(line.status, s)


class SalesReturnTest(TestCase):
    def setUp(self):
        self.warehouse = Warehouse.objects.create(
            warehouse_name='WH', code='WHR', country='C', city='C',
            company_id=1, branch_id=1
        )
        self.customer = Customer.objects.create(
            name='C', customer_code='SR01', company_id=1, branch_id=1
        )
        self.so = SalesOrder.objects.create(
            order_number='SO-SR', customer=self.customer,
            warehouse=self.warehouse, company_id=1, branch_id=1
        )

    def test_create(self):
        sr = SalesReturn.objects.create(
            return_number='SR-001', sales_order=self.so,
            warehouse=self.warehouse, return_date=date.today(),
            company_id=1, branch_id=1
        )
        self.assertEqual(sr.status, 'COMPLETED')

    def test_unique_return_number(self):
        SalesReturn.objects.create(
            return_number='SR-UNIQ', sales_order=self.so,
            warehouse=self.warehouse, return_date=date.today(),
            company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            SalesReturn.objects.create(
                return_number='SR-UNIQ', sales_order=self.so,
                warehouse=self.warehouse, return_date=date.today(),
                company_id=1, branch_id=1
            )


class SalesReturnLineTest(TestCase):
    def setUp(self):
        self.warehouse = Warehouse.objects.create(
            warehouse_name='WH', code='WHRL', country='C', city='C',
            company_id=1, branch_id=1
        )
        self.customer = Customer.objects.create(
            name='C', customer_code='SRL01', company_id=1, branch_id=1
        )
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='SRLV1', company_id=1, branch_id=1
        )
        self.so = SalesOrder.objects.create(
            order_number='SO-SRL', customer=self.customer,
            warehouse=self.warehouse, company_id=1, branch_id=1
        )
        self.so_line = SalesOrderLine.objects.create(
            sales_order=self.so, variant=self.variant,
            quantity_ordered=10, unit_price=Decimal('25.00'),
            company_id=1, branch_id=1
        )
        self.sr = SalesReturn.objects.create(
            return_number='SR-LINE', sales_order=self.so,
            warehouse=self.warehouse, return_date=date.today(),
            company_id=1, branch_id=1
        )

    def test_create(self):
        line = SalesReturnLine.objects.create(
            sales_return=self.sr, sales_order_line=self.so_line,
            quantity_returned=3, refund_amount=Decimal('75.00'),
            unit_cost=Decimal('15.00'), company_id=1, branch_id=1
        )
        self.assertTrue(line.restock)


class StockTransferTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='ST1', company_id=1, branch_id=1
        )
        self.wh1 = Warehouse.objects.create(
            warehouse_name='WH1', code='W1', country='C', city='C',
            company_id=1, branch_id=1
        )
        self.wh2 = Warehouse.objects.create(
            warehouse_name='WH2', code='W2', country='C', city='C',
            company_id=1, branch_id=1
        )

    def test_create(self):
        st = StockTransfer.objects.create(
            transfer_number='TRF-001', variant=self.variant,
            source_warehouse=self.wh1, destination_warehouse=self.wh2,
            quantity=50, company_id=1, branch_id=1
        )
        self.assertEqual(st.status, 'DRAFT')

    def test_transfer_number_unique(self):
        StockTransfer.objects.create(
            transfer_number='TRF-002', variant=self.variant,
            source_warehouse=self.wh1, destination_warehouse=self.wh2,
            quantity=10, company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            StockTransfer.objects.create(
                transfer_number='TRF-002', variant=self.variant,
                source_warehouse=self.wh1, destination_warehouse=self.wh2,
                quantity=20, company_id=1, branch_id=1
            )

    def test_planned_date(self):
        st = StockTransfer.objects.create(
            transfer_number='TRF-PLAN', variant=self.variant,
            source_warehouse=self.wh1, destination_warehouse=self.wh2,
            quantity=10, planned_date=date(2025, 8, 1),
            company_id=1, branch_id=1
        )
        self.assertEqual(st.planned_date, date(2025, 8, 1))

    def test_notes_field(self):
        st = StockTransfer.objects.create(
            transfer_number='TRF-NOTES', variant=self.variant,
            source_warehouse=self.wh1, destination_warehouse=self.wh2,
            quantity=10, notes='Urgent transfer',
            company_id=1, branch_id=1
        )
        self.assertEqual(st.notes, 'Urgent transfer')

    def test_status_choices(self):
        for s in ['DRAFT', 'PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']:
            st = StockTransfer.objects.create(
                transfer_number=f'TRF-{s}', variant=self.variant,
                source_warehouse=self.wh1, destination_warehouse=self.wh2,
                quantity=1, status=s, company_id=1, branch_id=1
            )
            self.assertEqual(st.status, s)


class StockReservationTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='SRV1', company_id=1, branch_id=1
        )
        self.warehouse = Warehouse.objects.create(
            warehouse_name='WH', code='WHSR', country='C', city='C',
            company_id=1, branch_id=1
        )

    def test_create(self):
        sr = StockReservation.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            quantity=10, reservation_type='SALES_ORDER',
            reference_id=uuid.uuid4(),
            reserved_until=date.today() + timedelta(days=7),
            company_id=1, branch_id=1
        )
        self.assertEqual(sr.status, 'ACTIVE')

    def test_status_choices(self):
        for s in ['ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED']:
            sr = StockReservation.objects.create(
                variant=self.variant, warehouse=self.warehouse,
                quantity=1, reservation_type='TEST',
                reference_id=uuid.uuid4(),
                reserved_until=date.today(), status=s,
                company_id=1, branch_id=1
            )
            self.assertEqual(sr.status, s)


class ReturnRefundTest(TestCase):
    def setUp(self):
        self.warehouse = Warehouse.objects.create(
            warehouse_name='WH', code='WHRR', country='C', city='C',
            company_id=1, branch_id=1
        )
        self.customer = Customer.objects.create(
            name='C', customer_code='RR01', company_id=1, branch_id=1
        )

    def test_create(self):
        rr = ReturnRefund.objects.create(
            return_number='RR-001', return_type='INVOICE',
            document_id=uuid.uuid4(), document_number='INV-001',
            customer=self.customer, warehouse=self.warehouse,
            return_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(rr.status, 'DRAFT')

    def test_return_type_choices(self):
        for rt in ['INVOICE', 'POS']:
            rr = ReturnRefund.objects.create(
                return_number=f'RR-{rt}', return_type=rt,
                document_id=uuid.uuid4(), warehouse=self.warehouse,
                return_date=date.today(), company_id=1, branch_id=1
            )
            self.assertEqual(rr.return_type, rt)

    def test_unique_return_number(self):
        ReturnRefund.objects.create(
            return_number='RR-UNIQ', return_type='INVOICE',
            document_id=uuid.uuid4(), warehouse=self.warehouse,
            return_date=date.today(), company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            ReturnRefund.objects.create(
                return_number='RR-UNIQ', return_type='INVOICE',
                document_id=uuid.uuid4(), warehouse=self.warehouse,
                return_date=date.today(), company_id=1, branch_id=1
            )

    def test_total_refund_amount(self):
        rr = ReturnRefund.objects.create(
            return_number='RR-AMT', return_type='POS',
            document_id=uuid.uuid4(), warehouse=self.warehouse,
            return_date=date.today(), total_refund_amount=Decimal('250.00'),
            company_id=1, branch_id=1
        )
        self.assertEqual(rr.total_refund_amount, Decimal('250.00'))


class ReturnRefundLineTest(TestCase):
    def setUp(self):
        self.warehouse = Warehouse.objects.create(
            warehouse_name='WH', code='WHRR', country='C', city='C',
            company_id=1, branch_id=1
        )
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='RRV1', company_id=1, branch_id=1
        )
        self.rr = ReturnRefund.objects.create(
            return_number='RR-LINE', return_type='INVOICE',
            document_id=uuid.uuid4(), warehouse=self.warehouse,
            return_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        line = ReturnRefundLine.objects.create(
            return_refund=self.rr, source_line_id=uuid.uuid4(),
            variant=self.variant, quantity=2,
            unit_price=Decimal('50.00'), refund_amount=Decimal('100.00'),
            company_id=1, branch_id=1
        )
        self.assertTrue(line.restock)
        self.assertFalse(line.return_to_supplier)

    def test_manual_entry(self):
        line = ReturnRefundLine.objects.create(
            return_refund=self.rr, source_line_id=uuid.uuid4(),
            variant=None, is_manual_entry=True,
            manual_variant_name='Custom Return', manual_variant_sku='CR-001',
            quantity=1, unit_price=Decimal('25.00'), refund_amount=Decimal('25.00'),
            company_id=1, branch_id=1
        )
        self.assertTrue(line.is_manual_entry)


class AlertTest(TestCase):
    def test_create(self):
        a = Alert.objects.create(
            type='LOW_STOCK', severity='warning',
            title='Low Stock Alert', message='Widget is low on stock',
            company_id=1, branch_id=1
        )
        self.assertFalse(a.is_read)

    def test_type_choices(self):
        for t in ['LOW_STOCK', 'STOCK_MOVEMENT', 'ORDER_CREATED', 'ORDER_COMPLETED',
                   'ORDER_CANCELLED', 'TRANSFER_CONFIRMED', 'PRICE_CHANGE', 'SYSTEM']:
            a = Alert.objects.create(
                type=t, title=f'Alert {t}', message='Test',
                company_id=1, branch_id=1
            )
            self.assertEqual(a.type, t)

    def test_severity_choices(self):
        for sev in ['info', 'warning', 'critical']:
            a = Alert.objects.create(
                type='SYSTEM', severity=sev, title=f'Sev {sev}', message='Test',
                company_id=1, branch_id=1
            )
            self.assertEqual(a.severity, sev)


class VariantAttributeTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='VAV1', company_id=1, branch_id=1
        )

    def test_create(self):
        va = VariantAttribute.objects.create(
            variant=self.variant, attribute_key='Color', attribute_value='Blue',
            company_id=1, branch_id=1
        )
        self.assertEqual(va.attribute_key, 'Color')

    def test_unique_together(self):
        VariantAttribute.objects.create(
            variant=self.variant, attribute_key='Size', attribute_value='L',
            company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            VariantAttribute.objects.create(
                variant=self.variant, attribute_key='Size', attribute_value='L',
                company_id=1, branch_id=1
            )


class VariantImageTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='VIV1', company_id=1, branch_id=1
        )

    def test_create(self):
        vi = VariantImage.objects.create(
            variant=self.variant, image_url='/media/img.jpg',
            is_primary=True, sort_order=1,
            company_id=1, branch_id=1
        )
        self.assertTrue(vi.is_primary)
        self.assertEqual(vi.sort_order, 1)

    def test_defaults(self):
        vi = VariantImage.objects.create(
            variant=self.variant, image_url='/media/img2.jpg',
            company_id=1, branch_id=1
        )
        self.assertFalse(vi.is_primary)
        self.assertEqual(vi.sort_order, 0)


class InventoryAuditLogTest(TestCase):
    def setUp(self):
        from apps.inventory.models.audit import AuditLog as InvAuditLog
        self.InvAuditLog = InvAuditLog

    def test_create(self):
        log = self.InvAuditLog.objects.create(
            user_id=1, action='CREATE', entity_type='product',
            entity_id=uuid.uuid4(), company_id=1, branch_id=1
        )
        self.assertEqual(log.source_module, 'inventory')

    def test_action_choices(self):
        for action in ['CREATE', 'UPDATE', 'DELETE', 'BULK_CREATE', 'BULK_UPDATE', 'BULK_DELETE']:
            log = self.InvAuditLog.objects.create(
                user_id=1, action=action, entity_type='test',
                entity_id=uuid.uuid4(), company_id=1, branch_id=1
            )
            self.assertEqual(log.action, action)


class InventoryAuditFieldChangeTest(TestCase):
    def setUp(self):
        from apps.inventory.models.audit import AuditLog as InvAuditLog, AuditFieldChange
        self.AuditFieldChange = AuditFieldChange
        self.log = InvAuditLog.objects.create(
            user_id=1, action='UPDATE', entity_type='product',
            entity_id=uuid.uuid4(), company_id=1, branch_id=1
        )

    def test_create(self):
        change = self.AuditFieldChange.objects.create(
            audit_log=self.log, field_name='name',
            old_value='Old', new_value='New',
            company_id=1, branch_id=1
        )
        self.assertEqual(change.field_name, 'name')
        self.assertEqual(change.old_value, 'Old')
        self.assertEqual(change.new_value, 'New')
