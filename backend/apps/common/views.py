from django.apps import apps
from django.core.cache import cache
from django.db.models import Model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

CODE_REGISTRY = {
    'brand': {'app': 'inventory', 'model': 'Brand', 'field': 'code', 'prefix': 'BRN'},
    'category': {'app': 'inventory', 'model': 'Category', 'field': 'code', 'prefix': 'CAT'},
    'warehouse': {'app': 'inventory', 'model': 'Warehouse', 'field': 'code', 'prefix': 'WRH'},
    'supplier': {'app': 'inventory', 'model': 'Supplier', 'field': 'code', 'prefix': 'SUP'},
    'customer': {'app': 'inventory', 'model': 'Customer', 'field': 'customer_code', 'prefix': 'CUS'},
    'product_variant': {'app': 'inventory', 'model': 'ProductVariant', 'field': 'sku', 'prefix': 'VAR'},
    'purchase_order': {'app': 'inventory', 'model': 'PurchaseOrder', 'field': 'order_number', 'prefix': 'PO'},
    'sales_order': {'app': 'inventory', 'model': 'SalesOrder', 'field': 'order_number', 'prefix': 'SO'},
    'transfer': {'app': 'inventory', 'model': 'StockTransfer', 'field': 'transfer_number', 'prefix': 'TRF'},
    'department': {'app': 'organization', 'model': 'Department', 'field': 'code', 'prefix': 'DEPT'},
    'account': {'app': 'finance', 'model': 'Account', 'field': 'code', 'prefix': 'ACC'},
    'employee': {'app': 'hr', 'model': 'Employee', 'field': 'employee_id', 'prefix': 'EMP'},
    'policy': {'app': 'hr', 'model': 'Policy', 'field': 'code', 'prefix': 'POL'},
    'customer_invoice': {'app': 'finance', 'model': 'CustomerInvoice', 'field': 'invoice_number', 'prefix': 'INV'},
    'supplier_bill': {'app': 'finance', 'model': 'SupplierBill', 'field': 'bill_number', 'prefix': 'BILL'},
    'expense': {'app': 'finance', 'model': 'Expense', 'field': 'expense_number', 'prefix': 'EXP'},
    'bank_account': {'app': 'finance', 'model': 'BankAccount', 'field': 'account_number', 'prefix': 'BA'},
}


class GenerateCodeView(APIView):
    def post(self, request):
        entity = request.data.get('entity')
        prefix = request.data.get('prefix')

        if entity not in CODE_REGISTRY:
            return Response({'error': f'Unknown entity: {entity}'}, status=status.HTTP_400_BAD_REQUEST)

        reg = CODE_REGISTRY[entity]
        prefix = prefix or reg['prefix']
        cache_key = f'code_counter:{entity}'

        try:
            counter = cache.incr(cache_key)
        except ValueError:
            counter = self._init_counter(entity, reg, prefix, cache_key)

        code = f'{prefix}-{counter:04d}'
        model = apps.get_model(reg['app'], reg['model'])
        field = reg['field']
        while model.objects.filter(**{field: code}).exists():
            counter = cache.incr(cache_key)
            code = f'{prefix}-{counter:04d}'

        return Response({'code': code})

    def _init_counter(self, entity, reg, prefix, cache_key):
        model = apps.get_model(reg['app'], reg['model'])
        field = reg['field']
        lookup = {f'{field}__startswith': f'{prefix}-'}
        existing = model.objects.filter(**lookup).order_by(f'-{field}').values_list(field, flat=True).first()
        if existing:
            try:
                last_num = int(existing.split('-')[-1])
                counter = last_num + 1
            except (ValueError, IndexError):
                counter = 1
        else:
            counter = 1
        cache.set(cache_key, counter, timeout=None)
        return counter


class ValidateCodeView(APIView):
    def post(self, request):
        entity = request.data.get('entity')
        code = request.data.get('code')
        exclude_id = request.data.get('exclude_id')

        if entity not in CODE_REGISTRY:
            return Response({'error': f'Unknown entity: {entity}'}, status=status.HTTP_400_BAD_REQUEST)

        reg = CODE_REGISTRY[entity]
        model = apps.get_model(reg['app'], reg['model'])
        field = reg['field']

        qs = model.objects.filter(**{field: code})
        if exclude_id:
            qs = qs.exclude(_id=exclude_id)

        return Response({'available': not qs.exists()})
