import os
import uuid
from django.apps import apps
from django.conf import settings
from django.core.cache import cache
from django.db.models import Model
from django.utils.text import get_valid_filename
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny

# Image processing
try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

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


ALLOWED_UPLOAD_TYPES = {
    'image': ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    'document': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'],
    'all': ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'],
}

MAX_FILE_SIZE_MB = 10


class FileUploadView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    THUMB_SIZES = {
        'list': (150, 150),
        'detail': (600, 600),
    }

    def post(self, request):
        file = request.FILES.get('file')
        module = request.data.get('module', 'general')
        submodule = request.data.get('submodule', '')
        file_type = request.data.get('type', 'all')

        if not file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ext = os.path.splitext(file.name)[1].lower().lstrip('.')
        allowed = ALLOWED_UPLOAD_TYPES.get(file_type, ALLOWED_UPLOAD_TYPES['all'])
        if ext not in allowed:
            return Response(
                {'error': f'File type .{ext} is not allowed. Allowed: {", ".join(allowed)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if file.size > MAX_FILE_SIZE_MB * 1024 * 1024:
            return Response(
                {'error': f'File size exceeds {MAX_FILE_SIZE_MB}MB limit'},
                status=status.HTTP_400_BAD_REQUEST
            )

        safe_module = get_valid_filename(module)
        safe_submodule = get_valid_filename(submodule) if submodule else ''

        upload_dir = os.path.join(settings.BASE_DIR, 'upload', safe_module)
        if safe_submodule:
            upload_dir = os.path.join(upload_dir, safe_submodule)
        os.makedirs(upload_dir, exist_ok=True)

        file_id = uuid.uuid4().hex
        filename = f'{file_id}.{ext}'
        filepath = os.path.join(upload_dir, filename)

        with open(filepath, 'wb+') as dest:
            for chunk in file.chunks():
                dest.write(chunk)

        relative_url = f'/upload/{safe_module}'
        if safe_submodule:
            relative_url += f'/{safe_submodule}'
        relative_url += f'/{filename}'

        response_data = {
            'url': relative_url,
            'url_thumb': '',
            'url_detail': '',
            'filename': file.name,
            'size': file.size,
            'type': file.content_type,
            'message': 'File uploaded successfully',
        }

        # Generate thumbnails for images
        is_image = ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']
        if is_image and PILLOW_AVAILABLE:
            try:
                thumb_url, detail_url = self._generate_thumbnails(
                    filepath, upload_dir, file_id, ext
                )
                response_data['url_thumb'] = thumb_url
                response_data['url_detail'] = detail_url
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Thumbnail generation failed: {e}")

        return Response(response_data, status=status.HTTP_201_CREATED)

    def _generate_thumbnails(self, filepath, upload_dir, file_id, ext):
        """Generate list-view thumbnail and detail-view image."""
        img = Image.open(filepath)
        
        # Convert RGBA to RGB for JPEG compatibility
        if img.mode in ('RGBA', 'P') and ext in ('jpg', 'jpeg'):
            img = img.convert('RGB')

        thumb_url = ''
        detail_url = ''

        # List view thumbnail (150x150)
        thumb_img = img.copy()
        thumb_img.thumbnail(self.THUMB_SIZES['list'], Image.LANCZOS)
        thumb_filename = f'{file_id}_thumb.{ext}'
        thumb_path = os.path.join(upload_dir, thumb_filename)
        thumb_img.save(thumb_path, quality=80, optimize=True)
        thumb_url = f'{os.path.dirname(filepath).replace(settings.BASE_DIR, "")}/{thumb_filename}'

        # Detail view image (600x600)
        detail_img = img.copy()
        detail_img.thumbnail(self.THUMB_SIZES['detail'], Image.LANCZOS)
        detail_filename = f'{file_id}_detail.{ext}'
        detail_path = os.path.join(upload_dir, detail_filename)
        detail_img.save(detail_path, quality=85, optimize=True)
        detail_url = f'{os.path.dirname(filepath).replace(settings.BASE_DIR, "")}/{detail_filename}'

        return thumb_url, detail_url

    def delete(self, request):
        file_url = request.data.get('url', '')
        if not file_url:
            return Response(
                {'error': 'No file URL provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not file_url.startswith('/upload/'):
            return Response(
                {'error': 'Invalid file URL'},
                status=status.HTTP_400_BAD_REQUEST
            )

        filepath = os.path.join(settings.BASE_DIR, file_url.lstrip('/'))
        if os.path.exists(filepath):
            os.remove(filepath)
            return Response({'message': 'File deleted successfully'})

        return Response(
            {'error': 'File not found'},
            status=status.HTTP_404_NOT_FOUND
        )
