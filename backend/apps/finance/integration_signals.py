from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from apps.inventory.models import GoodsReceipt, SalesOrder
from apps.finance.models import SupplierBill, CustomerInvoice

@receiver(post_save, sender=GoodsReceipt)
def create_supplier_bill_from_receipt(sender, instance, created, **kwargs):
    if created:
        po = instance.purchase_order
        if not SupplierBill.objects.filter(purchase_order=po, company_id=po.company_id, branch_id=po.branch_id).exists():
            SupplierBill.objects.create(
                bill_number=f"BILL-{po.order_number}",
                supplier=po.supplier,
                purchase_order=po,
                bill_date=instance.received_date.date(),
                due_date=po.expected_delivery_date or instance.received_date.date(),
                amount=po.total_amount,
                status='DRAFT',
                company_id=po.company_id,
                branch_id=po.branch_id,
                created_by=instance.received_by
            )

@receiver(post_save, sender=SalesOrder)
def create_customer_invoice_from_sales_order(sender, instance, **kwargs):
    if instance.status == 'COMPLETE' and not CustomerInvoice.objects.filter(sales_order=instance, company_id=instance.company_id, branch_id=instance.branch_id).exists():
        CustomerInvoice.objects.create(
            invoice_number=f"INV-{instance.order_number}",
            customer=instance.customer,
            sales_order=instance,
            invoice_date=instance.order_date or timezone.now().date(),
            due_date=instance.order_date or timezone.now().date(),
            amount=instance.total_amount,
            status='DRAFT',
            company_id=instance.company_id,
            branch_id=instance.branch_id,
            created_by=instance.updated_by or instance.created_by
        )