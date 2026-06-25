from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.inventory.models import (
    Category, Brand, Warehouse, Product, ProductVariant,
    StockItem, InventoryTransaction, Supplier, Customer,
    PurchaseOrder, PurchaseOrderLine, SalesOrder, SalesOrderLine,
    StockTransfer,
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


class BrandTest(TestCase):
    def test_create(self):
        b = Brand.objects.create(name='Samsung', code='SAM', company_id=1, branch_id=1)
        self.assertEqual(b.name, 'Samsung')

    def test_unique_together(self):
        Brand.objects.create(name='A', code='X', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            Brand.objects.create(name='B', code='X', company_id=1, branch_id=1)


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
        import uuid
        t = InventoryTransaction.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            quantity_change=10, quantity_before=0, quantity_after=10,
            transaction_type='PURCHASE_RECEIPT', transaction_id=uuid.uuid4(),
            company_id=1, branch_id=1
        )
        self.assertEqual(t.quantity_change, 10)

    def test_transaction_type_choices(self):
        import uuid
        for tt in ['PURCHASE_RECEIPT', 'SALE', 'RETURN_IN', 'ADJUSTMENT', 'TRANSFER_IN']:
            t = InventoryTransaction.objects.create(
                variant=self.variant, warehouse=self.warehouse,
                quantity_change=1, quantity_before=0, quantity_after=1,
                transaction_type=tt, transaction_id=uuid.uuid4(),
                company_id=1, branch_id=1
            )
            self.assertEqual(t.transaction_type, tt)


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
        self.assertEqual(line.discount_amount, 0)


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
