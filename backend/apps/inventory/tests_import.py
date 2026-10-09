"""Tests for product import duplicate detection and conflict-resolution policies.

Covers Bug 2 (duplicate detection / existing-record info), Bug 3 (Add New,
Update Existing, Skip Duplicates, Replace Existing) and Bug 4 (no raw DB errors).
"""
import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.inventory.models import (
    Brand, Category, Warehouse, Product, ProductVariant, StockItem,
)
from apps.inventory.views.product_import_export import (
    CONFLICT_POLICIES,
    ImportValidationError,
    _normalize_sku,
    _resolve_duplicates,
    _run_import,
    _validation_counts,
)
from apps.organization.models import Branch, Company

User = get_user_model()


def row(ridx, name, sku, **overrides):
    base = {
        'row_index': ridx,
        'product_name': name,
        'product_description': '',
        'category_name': '',
        'brand_name': '',
        'unit': 'PIECE',
        'storage_requirement': 'AMBIENT',
        'tax_rate': 0,
        'variant_sku': sku,
        'variant_title': '',
        'variant_barcode': '',
        'buying_price': 10,
        'selling_price': 20,
        'min_stock_level': 0,
        'max_stock_level': 0,
    }
    base.update(overrides)
    return base


class ProductImportBase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='importer', email='imp@example.com', password='x',
        )
        self.warehouse = Warehouse.objects.create(
            warehouse_name='Main', code='WH1', country='PK', city='LHR',
            company_id=1, branch_id=1,
        )

    def _variant(self, sku, product_name='Existing', company_id=1, branch_id=1,
                 is_deleted=False, **kwargs):
        product = Product.objects.create(
            product_name=product_name, company_id=company_id, branch_id=branch_id,
        )
        variant = ProductVariant.objects.create(
            product=product, sku=sku, company_id=company_id, branch_id=branch_id,
            is_deleted=is_deleted, **kwargs,
        )
        return product, variant


class SkuNormalizationTest(ProductImportBase):
    def test_trimmed(self):
        self.assertEqual(_normalize_sku('  ABC-1 '), 'ABC-1')

    def test_none_and_nan(self):
        self.assertEqual(_normalize_sku(None), '')
        self.assertEqual(_normalize_sku(float('nan')), '')

    def test_case_is_preserved(self):
        self.assertEqual(_normalize_sku('abc'), 'abc')


class DuplicateResolutionTest(ProductImportBase):
    def test_existing_active_sku_is_db_conflict(self):
        self._variant('SKU-1', product_name='Widget', variant_title='Red')
        by_index, active, _deleted = _resolve_duplicates([row(0, 'W', 'SKU-1')], 1, 1)
        info = by_index[0]
        self.assertEqual(info['conflict_type'], 'db_conflict')
        self.assertEqual(info['existing_product_name'], 'Widget')
        self.assertEqual(info['existing_variant_title'], 'Red')
        self.assertIn('SKU-1', active)

    def test_within_file_duplicate(self):
        rows = [row(0, 'W', 'DUP'), row(1, 'W', 'DUP')]
        by_index, _active, _deleted = _resolve_duplicates(rows, 1, 1)
        self.assertTrue(by_index[0]['is_duplicate_in_file'])
        self.assertTrue(by_index[1]['is_duplicate_in_file'])
        self.assertEqual(by_index[0]['duplicate_of_row_index'], 1)
        self.assertEqual(by_index[0]['conflict_type'], 'file_duplicate')

    def test_soft_deleted_sku_is_flagged(self):
        self._variant('SKU-DEL', is_deleted=True)
        by_index, _active, deleted = _resolve_duplicates([row(0, 'W', 'SKU-DEL')], 1, 1)
        self.assertEqual(by_index[0]['conflict_type'], 'soft_deleted')
        self.assertIn('SKU-DEL', deleted)

    def test_company_isolation(self):
        self._variant('SHARED', company_id=2, branch_id=2)
        by_index, _active, _deleted = _resolve_duplicates([row(0, 'W', 'SHARED')], 1, 1)
        self.assertIsNone(by_index[0]['conflict_type'])

    def test_case_sensitive_matching(self):
        self._variant('abc')
        lower, _a, _d = _resolve_duplicates([row(0, 'W', 'abc')], 1, 1)
        upper, _a2, _d2 = _resolve_duplicates([row(0, 'W', 'ABC')], 1, 1)
        self.assertEqual(lower[0]['conflict_type'], 'db_conflict')
        self.assertIsNone(upper[0]['conflict_type'])

    def test_blank_sku_is_not_a_conflict(self):
        by_index, _a, _d = _resolve_duplicates([row(0, 'W', '')], 1, 1)
        self.assertIsNone(by_index[0]['conflict_type'])
        self.assertFalse(by_index[0]['is_duplicate_in_file'])

    def test_counts(self):
        self._variant('SKU-1')
        rows = [row(0, 'W', 'SKU-1'), row(1, 'W', 'FREE')]
        by_index, _a, _d = _resolve_duplicates(rows, 1, 1)
        counts = _validation_counts(by_index)
        self.assertEqual(counts['valid'], 1)
        self.assertEqual(counts['conflicting'], 1)


class AddNewPolicyTest(ProductImportBase):
    def test_creates_product_variant_and_stock(self):
        result = _run_import([row(0, 'Widget', 'NEW-1')], 'add_new', 'excel',
                             self.user, 1, 1, self.warehouse)
        self.assertEqual(result['data']['products_created'], 1)
        self.assertEqual(result['data']['variants_created'], 1)
        variant = ProductVariant.objects.get(sku='NEW-1')
        self.assertEqual(variant.company_id, 1)
        self.assertTrue(StockItem.objects.filter(variant=variant).exists())

    def test_blank_sku_generated_unique(self):
        result = _run_import([row(0, 'Widget', '')], 'add_new', 'excel',
                             self.user, 1, 1, self.warehouse)
        self.assertEqual(result['data']['variants_created'], 1)
        variant = ProductVariant.objects.filter(product__product_name='Widget').first()
        self.assertTrue(variant.sku)

    def test_existing_sku_blocks_whole_import(self):
        self._variant('DUP')
        with self.assertRaises(ImportValidationError):
            _run_import([row(0, 'Widget', 'DUP')], 'add_new', 'excel',
                        self.user, 1, 1, self.warehouse)
        self.assertFalse(Product.objects.filter(product_name='Widget').exists())

    def test_soft_deleted_sku_blocks(self):
        self._variant('DEL', is_deleted=True)
        with self.assertRaises(ImportValidationError):
            _run_import([row(0, 'Widget', 'DEL')], 'add_new', 'excel',
                        self.user, 1, 1, self.warehouse)


class UpdateExistingPolicyTest(ProductImportBase):
    def test_updates_fields_and_preserves_stock_and_ids(self):
        product, variant = self._variant('UPD-1', product_name='Old')
        StockItem.objects.create(
            variant=variant, warehouse=self.warehouse, quantity_on_hand=42,
            company_id=1, branch_id=1,
        )
        before_id = variant.id
        result = _run_import(
            [row(0, 'Old', 'UPD-1', variant_title='New', selling_price=99)],
            'update_existing', 'excel', self.user, 1, 1, self.warehouse,
        )
        variant.refresh_from_db()
        self.assertEqual(variant.id, before_id)
        self.assertEqual(variant.variant_title, 'New')
        self.assertEqual(variant.selling_price, Decimal('99'))
        self.assertEqual(result['data']['variants_updated'], 1)
        self.assertEqual(result['data']['products_updated'], 1)
        self.assertEqual(StockItem.objects.get(variant=variant).quantity_on_hand, 42)

    def test_empty_cell_preserves_existing_value(self):
        _product, variant = self._variant('UPD-2', barcode='KEEP')
        _run_import(
            [row(0, 'Existing', 'UPD-2', variant_barcode='')],
            'update_existing', 'excel', self.user, 1, 1, self.warehouse,
        )
        variant.refresh_from_db()
        self.assertEqual(variant.barcode, 'KEEP')

    def test_unmatched_row_becomes_new_variant_of_matched_product(self):
        product, _variant = self._variant('UPD-3', product_name='Fam')
        _run_import(
            [row(0, 'Fam', 'UPD-3'), row(1, 'Fam', 'NEW-VAR')],
            'update_existing', 'excel', self.user, 1, 1, self.warehouse,
        )
        product.refresh_from_db()
        self.assertEqual(product.variants.count(), 2)


class ReplaceExistingPolicyTest(ProductImportBase):
    def test_overwrites_fields_in_place_and_preserves_stock(self):
        product, variant = self._variant(
            'REP-1', product_name='Old', variant_title='t', barcode='OLD',
        )
        StockItem.objects.create(
            variant=variant, warehouse=self.warehouse, quantity_on_hand=7,
            company_id=1, branch_id=1,
        )
        before_id = variant.id
        _run_import(
            [row(0, 'NewName', 'REP-1', variant_barcode='', variant_title='')],
            'replace_existing', 'excel', self.user, 1, 1, self.warehouse,
        )
        variant.refresh_from_db()
        product.refresh_from_db()
        self.assertEqual(variant.id, before_id)
        self.assertEqual(variant.barcode, '')
        self.assertEqual(product.product_name, 'NewName')
        self.assertEqual(StockItem.objects.get(variant=variant).quantity_on_hand, 7)

    def test_no_delete_and_recreate(self):
        _product, variant = self._variant('REP-2', product_name='Keep')
        before = ProductVariant.objects.filter(sku='REP-2').count()
        _run_import(
            [row(0, 'Keep', 'REP-2', selling_price=5)],
            'replace_existing', 'excel', self.user, 1, 1, self.warehouse,
        )
        self.assertEqual(ProductVariant.objects.filter(sku='REP-2').count(), before)


class SkipDuplicatesPolicyTest(ProductImportBase):
    def test_skips_conflict_and_imports_valid(self):
        self._variant('EXIST')
        rows = [row(0, 'A', 'EXIST'), row(1, 'B', 'FRESH')]
        result = _run_import(rows, 'skip_duplicates', 'excel',
                             self.user, 1, 1, self.warehouse)
        self.assertEqual(result['data']['rows_skipped'], 1)
        self.assertEqual(result['data']['products_created'], 1)
        self.assertTrue(ProductVariant.objects.filter(sku='FRESH').exists())
        self.assertEqual(result['data']['skipped'][0]['reason'], 'existing_sku')

    def test_keeps_first_of_within_file_duplicates(self):
        rows = [row(0, 'A', 'SAMEFILE'), row(1, 'A', 'SAMEFILE')]
        result = _run_import(rows, 'skip_duplicates', 'excel',
                             self.user, 1, 1, self.warehouse)
        self.assertEqual(ProductVariant.objects.filter(sku='SAMEFILE').count(), 1)
        self.assertEqual(result['data']['rows_skipped'], 1)


class ConcurrentConflictTest(ProductImportBase):
    def test_conflict_created_after_preview_is_caught_on_import(self):
        # Preview/validation time: the SKU is free.
        by_index, _a, _d = _resolve_duplicates([row(0, 'W', 'RACE-1')], 1, 1)
        self.assertIsNone(by_index[0]['conflict_type'])
        # Another import creates the same SKU after the preview was shown.
        self._variant('RACE-1', product_name='Other')
        # Confirm re-resolves server-side and blocks the write.
        with self.assertRaises(ImportValidationError):
            _run_import([row(0, 'W', 'RACE-1')], 'add_new', 'excel',
                        self.user, 1, 1, self.warehouse)
        self.assertFalse(Product.objects.filter(product_name='W').exists())

    def test_after_preview_conflict_skipped_under_skip_policy(self):
        _by_index, _a, _d = _resolve_duplicates([row(0, 'W', 'RACE-2')], 1, 1)
        self._variant('RACE-2')
        result = _run_import([row(0, 'W', 'RACE-2')], 'skip_duplicates', 'excel',
                             self.user, 1, 1, self.warehouse)
        self.assertEqual(result['data']['rows_skipped'], 1)
        self.assertEqual(result['data']['products_created'], 0)


class PolicyConstantsTest(TestCase):
    def test_all_four_policies_present(self):
        self.assertEqual(
            CONFLICT_POLICIES,
            {'add_new', 'update_existing', 'skip_duplicates', 'replace_existing'},
        )


class ImportNoRawDbErrorTest(ProductImportBase):
    def test_conflict_error_messages_are_friendly(self):
        self._variant('RAW-1', product_name='Thing')
        by_index, _a, _d = _resolve_duplicates([row(0, 'W', 'RAW-1')], 1, 1)
        from apps.inventory.views.product_import_export import _conflict_error
        entry = _conflict_error(row(0, 'W', 'RAW-1'), by_index[0])
        self.assertEqual(entry['code'], 'db_conflict')
        self.assertNotIn('duplicate key', entry['message'].lower())
        self.assertIn('Thing', entry['message'])

    def test_message_includes_location_context(self):
        product, variant = self._variant('RAW-2', product_name='Thing')
        from apps.inventory.views.product_import_export import _conflict_message
        by_index, _a, _d = _resolve_duplicates([row(0, 'W', 'RAW-2')], 1, 1)
        message = _conflict_message(row(0, 'W', 'RAW-2'), by_index[0])
        self.assertIn('RAW-2', message)
        self.assertIn('Thing', message)


class UnexpectedDbErrorTest(ProductImportBase):
    """An IntegrityError that escapes the pre-checks must still be friendly."""

    def _patch_group(self):
        from unittest import mock

        from django.db import IntegrityError
        return mock.patch(
            'apps.inventory.views.product_import_export._process_group',
            side_effect=IntegrityError(
                'duplicate key value violates unique constraint '
                '"inventory_product_variants_company_id_branch_id_sku_key"'
            ),
        )

    def test_row_scoped_validation_error_for_all_or_nothing_policies(self):
        with self._patch_group():
            with self.assertRaises(ImportValidationError) as ctx:
                _run_import([row(0, 'Widget', 'X-1')], 'add_new', 'excel',
                            self.user, 1, 1, self.warehouse)
        errors = ctx.exception.errors
        self.assertEqual(errors[0]['row_index'], 0)
        self.assertEqual(errors[0]['code'], 'db_conflict')
        self.assertNotIn('duplicate key', errors[0]['message'])

    def test_reported_as_failed_under_skip_policy(self):
        with self._patch_group():
            result = _run_import([row(0, 'Widget', 'Y-1')], 'skip_duplicates',
                                 'excel', self.user, 1, 1, self.warehouse)
        self.assertEqual(result['data']['rows_failed'], 1)
        self.assertEqual(result['data']['failed'][0]['row_index'], 0)
        self.assertNotIn('duplicate key', result['data']['failed'][0]['message'])


class ImportApiTest(ProductImportBase):
    """API-level (APIClient) coverage for the parse/validate/confirm endpoints."""

    def setUp(self):
        super().setUp()
        self.company = Company.objects.create(
            name='Alpha', short_name='ALPHA', city='LHR', country='PK',
            email='alpha@example.com',
        )
        self.branch = Branch.objects.create(
            company=self.company, name='HQ', code='HQ', city='LHR', state='P',
            country='PK', email='hq@example.com',
        )
        self.user.is_superuser = True  # bypasses DB permission seeding
        self.user.company = self.company
        self.user.branch = self.branch
        self.user.save()
        self.company_id = self.company.id
        self.branch_id = self.branch.id
        Warehouse.objects.create(
            warehouse_name='Main', code='WHM', country='PK', city='LHR',
            company_id=self.company_id, branch_id=self.branch_id,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    CSV_HEADER = (
        'Product Name,Product Description,Category,Brand,Unit,'
        'Storage Requirement,Tax Rate (%),Variant SKU,Variant Title,'
        'Variant Barcode,Buying Price,Selling Price,Min Stock Level,Max Stock Level'
    )

    def _csv(self, *lines):
        content = '\n'.join([self.CSV_HEADER, *lines]) + '\n'
        return SimpleUploadedFile(
            'upload.csv', content.encode('utf-8'), content_type='text/csv',
        )

    def _variant_in_scope(self, sku, product_name='Existing', **kwargs):
        return self._variant(
            sku, product_name=product_name,
            company_id=self.company_id, branch_id=self.branch_id, **kwargs,
        )

    def _import_row(self, ridx, name, sku, **overrides):
        return row(ridx, name, sku, **overrides)

    # ── parse ──

    def test_parse_returns_existing_metadata(self):
        self._variant_in_scope('SKU-1', product_name='Widget')
        response = self.client.post(
            '/api/inventory/products/import/parse/',
            {'file': self._csv('New,Desc,Cat,Brand,PIECE,AMBIENT,0,SKU-1,Red,,10,20,0,0')},
            format='multipart',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'success')
        first = payload['data']['rows'][0]
        self.assertEqual(first['conflict_type'], 'db_conflict')
        self.assertEqual(first['existing_product_name'], 'Widget')
        self.assertEqual(first['existing_match'], 'active')
        self.assertEqual(payload['data']['counts']['conflicting'], 1)

    def test_parse_flags_within_file_duplicate(self):
        response = self.client.post(
            '/api/inventory/products/import/parse/',
            {'file': self._csv(
                'A,,Cat,Brand,PIECE,AMBIENT,0,DUP,t,,10,20,0,0',
                'B,,Cat,Brand,PIECE,AMBIENT,0,DUP,t,,10,20,0,0',
            )},
            format='multipart',
        )
        self.assertEqual(response.status_code, 200)
        rows = response.json()['data']['rows']
        self.assertTrue(all(r['is_duplicate_in_file'] for r in rows))
        self.assertEqual(rows[0]['duplicate_of_row_index'], 1)

    def test_parse_tenant_isolation(self):
        # Same SKU exists only in another company → not a conflict here.
        self._variant('SHARED', company_id=self.company_id + 99,
                      branch_id=self.branch_id + 99)
        response = self.client.post(
            '/api/inventory/products/import/parse/',
            {'file': self._csv('New,,, ,PIECE,AMBIENT,0,SHARED,t,,10,20,0,0')},
            format='multipart',
        )
        self.assertEqual(response.status_code, 200)
        first = response.json()['data']['rows'][0]
        self.assertIsNone(first['conflict_type'])
        self.assertNotIn('existing_product_name', first)

    # ── validate ──

    def test_validate_endpoint_returns_conflicts(self):
        self._variant_in_scope('VAL-1', product_name='Widget')
        response = self.client.post(
            '/api/inventory/products/import/validate/',
            {'rows': [{'row_index': 0, 'variant_sku': 'VAL-1'}]},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['data']['rows'][0]['conflict_type'], 'db_conflict')
        self.assertEqual(payload['data']['rows'][0]['existing_product_name'], 'Widget')

    # ── confirm ──

    def _confirm(self, rows, policy='add_new'):
        return self.client.post(
            '/api/inventory/products/import/confirm/',
            {'rows': rows, 'source': 'excel', 'conflict_policy': policy},
            format='json',
        )

    def test_confirm_add_new_success(self):
        response = self._confirm([
            self._import_row(0, 'Widget', 'API-1'),
            self._import_row(1, 'Widget', 'API-2'),
        ])
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['data']['products_created'], 1)
        self.assertEqual(payload['data']['variants_created'], 2)
        self.assertEqual(ProductVariant.objects.filter(
            company_id=self.company_id, branch_id=self.branch_id,
        ).count(), 2)

    def test_confirm_unknown_policy_is_friendly_400(self):
        response = self._confirm([self._import_row(0, 'Widget', 'API-3')], 'bogus')
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertEqual(body['status'], 'error')
        self.assertIn('bogus', body['message'])

    def test_confirm_duplicate_returns_friendly_row_scoped_422(self):
        self._variant_in_scope('API-4', product_name='Widget')
        response = self._confirm([self._import_row(0, 'New', 'API-4')])
        self.assertEqual(response.status_code, 422)
        body = response.json()
        self.assertIn('errors', body)
        raw = json.dumps(body).lower()
        self.assertNotIn('duplicate key', raw)
        self.assertNotIn('constraint', raw)
        self.assertNotIn('sql', raw)
        first = body['errors'][0]
        self.assertEqual(first['row_index'], 0)
        self.assertIn('Widget', first['message'])
        self.assertFalse(Product.objects.filter(product_name='New').exists())

    def test_confirm_missing_product_name_422(self):
        response = self._confirm([self._import_row(0, '', 'API-5')])
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()['errors'][0]['code'], 'required')

    def test_confirm_negative_price_422(self):
        response = self._confirm([
            self._import_row(0, 'Widget', 'API-6', selling_price=-5),
        ])
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()['errors'][0]['code'], 'invalid')

    def test_confirm_update_existing_updates_in_place(self):
        _product, variant = self._variant_in_scope('API-7', product_name='Old')
        before_id = variant.id
        response = self._confirm(
            [self._import_row(0, 'Old', 'API-7', selling_price=99)],
            'update_existing',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['data']['products_updated'], 1)
        self.assertEqual(payload['data']['variants_updated'], 1)
        variant.refresh_from_db()
        self.assertEqual(variant.id, before_id)
        self.assertEqual(variant.selling_price, Decimal('99'))

    def test_confirm_skip_duplicates_reports_skipped(self):
        self._variant_in_scope('API-8')
        response = self._confirm([
            self._import_row(0, 'A', 'API-8'),
            self._import_row(1, 'B', 'API-9'),
        ], 'skip_duplicates')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['data']['rows_skipped'], 1)
        self.assertEqual(payload['data']['products_created'], 1)
        self.assertEqual(payload['data']['skipped'][0]['reason'], 'existing_sku')
        self.assertEqual(payload['data']['skipped'][0]['row_index'], 0)

    def test_confirm_replace_existing_keeps_id(self):
        _product, variant = self._variant_in_scope('API-10', product_name='Old')
        before_id = variant.id
        response = self._confirm(
            [self._import_row(0, 'Renamed', 'API-10', variant_barcode='')],
            'replace_existing',
        )
        self.assertEqual(response.status_code, 200)
        variant.refresh_from_db()
        self.assertEqual(variant.id, before_id)
        self.assertEqual(variant.barcode, '')

    def test_confirm_soft_deleted_sku_blocks_add_new(self):
        self._variant_in_scope('API-11', is_deleted=True)
        response = self._confirm([self._import_row(0, 'Widget', 'API-11')])
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()['errors'][0]['code'], 'soft_deleted')
