"""Tests for the Settings → Trash module.

Run with::

    python manage.py test apps.compsetting.tests_trash --settings=config.test_settings

Notes on fixtures
-----------------
``setUpTestData`` objects are shared class attributes. Purging a row sets its
pk to ``None``, so every test re-fetches the objects it touches via ``self.obj()``
instead of mutating the class-level fixture.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.common.test_base import BaseTestCase
from apps.inventory.models import (
    Brand,
    Category,
    Product,
    ProductVariant,
    StockItem,
    Warehouse,
)
from apps.organization.models import Branch, Company
from apps.permissions.checks import build_permission_code
from apps.permissions.models import (
    Action,
    Module,
    Permission,
    Resource,
    Role,
    RolePermission,
    UserRole,
)

from .trash import services
from .trash.registry import TRASH_BY_KEY, TRASH_MODELS, build_display_name

TRASH_BASE = '/api/company/settings/trash/'
TRASH_ACTIONS = ('view', 'delete', 'restore')


def grant_trash_permissions(user, *actions):
    """Give ``user`` SETTINGS:trash:<action> through a dedicated role."""
    module, _ = Module.objects.get_or_create(
        code='SETTINGS', defaults={'name': 'System Settings'},
    )
    resource, _ = Resource.objects.get_or_create(
        module=module, code='trash', defaults={'name': 'Trash'},
    )
    role, _ = Role.objects.get_or_create(
        name='Trash Tester', defaults={'description': 'isolated trash test role'},
    )
    UserRole.objects.get_or_create(user=user, role=role)

    for action_code in actions:
        action, _ = Action.objects.get_or_create(
            code=action_code, defaults={'name': action_code.title()},
        )
        permission, _ = Permission.objects.get_or_create(
            resource=resource,
            action=action,
            defaults={'code': build_permission_code('SETTINGS', 'trash', action_code)},
        )
        RolePermission.objects.get_or_create(
            role=role, permission=permission, defaults={'granted': True},
        )

    cache.clear()
    return role


class TrashFixtureMixin:
    """Shared fixtures: brands/category plus a product→variant→stock graph."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.brand_a = Brand.objects.create(
            name='Trash Brand A', code='TBA',
            company_id=cls.company.id, branch_id=cls.branch.id,
        )
        cls.brand_b = Brand.objects.create(
            name='Trash Brand B', code='TBB',
            company_id=cls.company.id, branch_id=cls.branch.id,
        )
        cls.category = Category.objects.create(
            name='Trash Cat', code='TCAT',
            company_id=cls.company.id, branch_id=cls.branch.id,
        )
        cls.warehouse = Warehouse.objects.create(
            warehouse_name='Trash WH', code='TWH',
            company_id=cls.company.id, branch_id=cls.branch.id,
        )
        cls.product = Product.objects.create(
            product_name='Trash Product',
            company_id=cls.company.id, branch_id=cls.branch.id, unit='PCS',
        )
        cls.variant = ProductVariant.objects.create(
            product=cls.product, sku='TRASH-SKU-1',
            company_id=cls.company.id, branch_id=cls.branch.id,
        )
        cls.stock = StockItem.objects.create(
            variant=cls.variant, warehouse=cls.warehouse,
            company_id=cls.company.id, branch_id=cls.branch.id, quantity_on_hand=3,
        )

    # ── helpers ────────────────────────────────────────────────────────────
    def obj(self, fixture):
        """Fresh instance of a class-level fixture (pk survives across tests)."""
        return type(fixture).objects.get(pk=fixture.pk)

    def soft_delete(self, fixture_or_obj, user=None, when=None):
        """Soft-delete a row and return the refreshed instance."""
        obj = self.obj(fixture_or_obj)
        obj.is_deleted = True
        obj.deleted_by = user or self.admin
        obj.save()
        if when is not None:
            type(obj).objects.filter(pk=obj.pk).update(deleted_at=when)
        obj.refresh_from_db()
        return obj

    def auth_client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client


# ─────────────────────────────────────────────────────────────────────────────
# 1. deleted_at bookkeeping
# ─────────────────────────────────────────────────────────────────────────────

class DeletedAtTestCase(TrashFixtureMixin, BaseTestCase):

    def test_soft_delete_stamps_deleted_at(self):
        self.assertIsNone(self.obj(self.brand_a).deleted_at)
        brand = self.soft_delete(self.brand_a)
        self.assertIsNotNone(brand.deleted_at)
        self.assertLess(abs((timezone.now() - brand.deleted_at).total_seconds()), 5)

    def test_update_fields_soft_delete_still_stamps(self):
        """Existing views call save(update_fields=['is_deleted']) — must work."""
        brand = self.obj(self.brand_a)
        brand.is_deleted = True
        brand.deleted_by = self.admin
        brand.save(update_fields=['is_deleted', 'deleted_by'])
        brand.refresh_from_db()
        self.assertIsNotNone(brand.deleted_at)

    def test_restore_clears_deleted_at_and_deleted_by(self):
        brand = self.soft_delete(self.brand_a)
        brand.is_deleted = False
        brand.save()
        brand.refresh_from_db()
        self.assertIsNone(brand.deleted_at)
        self.assertIsNone(brand.deleted_by)

    def test_bulk_update_does_not_stamp(self):
        """Documented limitation: queryset.update() bypasses save()."""
        Brand.objects.filter(pk=self.brand_b.pk).update(is_deleted=True)
        self.assertIsNone(self.obj(self.brand_b).deleted_at)

    def test_deleted_at_is_not_overwritten_on_resave(self):
        brand = self.soft_delete(self.brand_a)
        first = brand.deleted_at
        brand.code = 'TBA2'
        brand.save()
        brand.refresh_from_db()
        self.assertEqual(brand.deleted_at, first)

    def test_user_model_also_stamps_deleted_at(self):
        self.admin.is_deleted = True
        self.admin.save()
        self.admin.refresh_from_db()
        self.assertIsNotNone(self.admin.deleted_at)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Listing / filtering / pagination
# ─────────────────────────────────────────────────────────────────────────────

class TrashListingTestCase(TrashFixtureMixin, BaseTestCase):

    def setUp(self):
        super().setUp()
        self.client = self.auth_client(self.admin)

    def test_empty_trash_returns_empty_page(self):
        resp = self.client.get(TRASH_BASE)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data']['count'], 0)
        self.assertEqual(resp.data['data']['retention_days'], 30)

    def test_lists_deleted_rows_only(self):
        brand = self.soft_delete(self.brand_a)
        resp = self.client.get(TRASH_BASE)
        self.assertEqual(resp.status_code, 200)
        body = resp.data['data']
        self.assertEqual(body['count'], 1)
        entry = body['results'][0]
        self.assertEqual(entry['type_key'], 'brand')
        self.assertEqual(entry['type_label'], 'Brand')
        self.assertEqual(entry['group'], 'Inventory')
        self.assertEqual(entry['_id'], str(brand._id))
        self.assertIn('Trash Brand A', entry['display_name'])
        self.assertEqual(entry['deleted_by'], self.admin.username)
        self.assertFalse(entry['is_expired'])
        self.assertEqual(entry['days_left'], 30)

    def test_seeded_is_deleted_rows_without_deleted_at_are_hidden(self):
        """Seed/demo rows have is_deleted=True but no deleter — never in trash."""
        Brand.objects.filter(pk=self.brand_b.pk).update(is_deleted=True)
        resp = self.client.get(TRASH_BASE)
        self.assertEqual(resp.data['data']['count'], 0)

    def test_filter_by_type(self):
        self.soft_delete(self.brand_a)
        self.soft_delete(self.category)

        only_brand = self.client.get(TRASH_BASE, {'type': 'brand'})
        self.assertEqual(only_brand.data['data']['count'], 1)
        self.assertEqual(only_brand.data['data']['results'][0]['type_key'], 'brand')

        multi = self.client.get(TRASH_BASE, {'type': 'brand,category'})
        self.assertEqual(multi.data['data']['count'], 2)

    def test_unknown_type_returns_404(self):
        resp = self.client.get(TRASH_BASE, {'type': 'does_not_exist'})
        self.assertEqual(resp.status_code, 404)
        self.assertFalse(resp.data['success'])

    def test_search_matches_label_fields(self):
        self.soft_delete(self.brand_a)
        self.soft_delete(self.brand_b)

        resp = self.client.get(TRASH_BASE, {'search': 'Brand A'})
        self.assertEqual(resp.data['data']['count'], 1)
        self.assertIn('Brand A', resp.data['data']['results'][0]['display_name'])

    def test_search_matches_related_field(self):
        """Product labels use ``category__name`` — relation search must work."""
        category = self.obj(self.category)
        product = self.obj(self.product)
        product.category = category
        product.save(update_fields=['category'])
        self.soft_delete(product)

        resp = self.client.get(TRASH_BASE, {'search': 'Trash Cat'})
        self.assertEqual(resp.data['data']['count'], 1)
        self.assertEqual(resp.data['data']['results'][0]['type_key'], 'product')
        self.assertIn('Trash Cat', resp.data['data']['results'][0]['display_name'])

    def test_expired_filter(self):
        old = self.soft_delete(self.brand_a, when=timezone.now() - timedelta(days=40))
        self.soft_delete(self.brand_b, when=timezone.now() - timedelta(days=1))

        expired = self.client.get(TRASH_BASE, {'expired': 'true'})
        self.assertEqual(expired.data['data']['count'], 1)
        self.assertTrue(expired.data['data']['results'][0]['is_expired'])
        self.assertEqual(expired.data['data']['results'][0]['_id'], str(old._id))
        self.assertEqual(expired.data['data']['results'][0]['days_left'], 0)

    def test_ordering_newest_first(self):
        older = self.soft_delete(self.brand_a, when=timezone.now() - timedelta(days=10))
        newer = self.soft_delete(self.brand_b, when=timezone.now() - timedelta(days=2))

        resp = self.client.get(TRASH_BASE)
        ids = [r['_id'] for r in resp.data['data']['results']]
        self.assertEqual(ids, [str(newer._id), str(older._id)])

    def test_pagination(self):
        for i in range(5):
            self.soft_delete(Brand.objects.create(
                name=f'Trash Paged {i}', code=f'TP{i}',
                company_id=self.company.id, branch_id=self.branch.id,
            ))

        page1 = self.client.get(TRASH_BASE, {'page_size': 2, 'page': 1})
        self.assertEqual(page1.data['data']['count'], 5)
        self.assertEqual(len(page1.data['data']['results']), 2)
        self.assertEqual(page1.data['data']['total_pages'], 3)
        self.assertEqual(page1.data['data']['next'], 2)
        self.assertIsNone(page1.data['data']['previous'])

        page3 = self.client.get(TRASH_BASE, {'page_size': 2, 'page': 3})
        self.assertEqual(len(page3.data['data']['results']), 1)
        self.assertIsNone(page3.data['data']['next'])
        self.assertEqual(page3.data['data']['previous'], 2)

    def test_summary_counts_and_types(self):
        self.soft_delete(self.brand_a)
        self.soft_delete(self.brand_b, when=timezone.now() - timedelta(days=45))

        resp = self.client.get(TRASH_BASE + 'summary/')
        self.assertEqual(resp.status_code, 200)
        data = resp.data['data']
        self.assertEqual(data['total'], 2)
        self.assertEqual(data['expired'], 1)
        self.assertEqual(data['within_retention'], 1)
        self.assertEqual(data['retention_days'], 30)

        brand = next(t for t in data['types'] if t['key'] == 'brand')
        self.assertEqual(brand['count'], 2)
        self.assertEqual(brand['expired'], 1)
        self.assertNotIn('category', [t['key'] for t in data['types']])


# ─────────────────────────────────────────────────────────────────────────────
# 3. Tenancy isolation
# ─────────────────────────────────────────────────────────────────────────────

class TrashTenancyTestCase(TrashFixtureMixin, BaseTestCase):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        from django.contrib.auth import get_user_model
        User = get_user_model()

        cls.other_company = Company.objects.create(
            name='Other Co', short_name='OC', city='Karachi', country='Pakistan',
            email='other@company.com',
        )
        cls.other_branch = Branch.objects.create(
            company=cls.other_company, name='Other HQ', code='OHQ',
            city='Karachi', country='Pakistan', email='ohq@other.com', is_hq=True,
        )
        cls.other_brand = Brand.objects.create(
            name='Other Co Brand', code='OCB',
            company_id=cls.other_company.id, branch_id=cls.other_branch.id,
        )
        cls.branch2 = Branch.objects.create(
            company=cls.company, name='Second Branch', code='BR2',
            city='Lahore', country='Pakistan', email='br2@test.com',
        )
        cls.branch2_user = User.objects.create_user(
            username='branch_mgr', email='branch@test.com', password='testpass123',
            company=cls.company, branch=cls.branch2, role='BRANCH_ADMIN',
        )
        grant_trash_permissions(cls.branch2_user, *TRASH_ACTIONS)

    def setUp(self):
        super().setUp()
        cache.clear()

    def test_other_company_rows_are_invisible(self):
        mine = self.soft_delete(self.brand_a)
        theirs = self.soft_delete(self.other_brand, user=self.admin)

        resp = self.auth_client(self.admin).get(TRASH_BASE)
        ids = [r['_id'] for r in resp.data['data']['results']]
        self.assertIn(str(mine._id), ids)
        self.assertNotIn(str(theirs._id), ids)

    def test_other_company_entry_cannot_be_purged(self):
        theirs = self.soft_delete(self.other_brand, user=self.admin)
        resp = self.auth_client(self.admin).delete(f'{TRASH_BASE}brand/{theirs._id}/')
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(Brand.objects.filter(pk=theirs.pk).exists())

    def test_branch_scope_limits_non_admin(self):
        brand_b1 = self.soft_delete(Brand.objects.create(
            name='Branch1 Brand', code='B1B',
            company_id=self.company.id, branch_id=self.branch.id,
        ))
        brand_b2 = self.soft_delete(Brand.objects.create(
            name='Branch2 Brand', code='B2B',
            company_id=self.company.id, branch_id=self.branch2.id,
        ))

        resp = self.auth_client(self.branch2_user).get(TRASH_BASE)
        ids = [r['_id'] for r in resp.data['data']['results']]
        self.assertIn(str(brand_b2._id), ids)
        self.assertNotIn(str(brand_b1._id), ids)

    def test_company_admin_sees_all_branches(self):
        brand_b2 = self.soft_delete(Brand.objects.create(
            name='Branch2 Brand CA', code='B2CA',
            company_id=self.company.id, branch_id=self.branch2.id,
        ))
        resp = self.auth_client(self.admin).get(TRASH_BASE)
        ids = [r['_id'] for r in resp.data['data']['results']]
        self.assertIn(str(brand_b2._id), ids)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Permanent delete (cascade) + restore
# ─────────────────────────────────────────────────────────────────────────────

class TrashPurgeTestCase(TrashFixtureMixin, BaseTestCase):

    def setUp(self):
        super().setUp()
        self.client = self.auth_client(self.admin)

    def _soft_delete_product_graph(self):
        """Mirror inventory ProductViewSet.destroy (soft delete + cascade)."""
        product = self.obj(self.product)
        product.is_deleted = True
        product.deleted_by = self.admin
        product.save()
        ProductVariant.objects.filter(product=product).update(is_deleted=True)
        StockItem.objects.filter(variant=self.variant).update(is_deleted=True)
        product.refresh_from_db()
        return product

    # ── BUG-20261010-05 regression: destroy() did not record the deleter ────
    def _delete_product_through_api(self):
        product = self.obj(self.product)
        resp = self.client.delete(f'/api/inventory/products/{product._id}/')
        self.assertIn(resp.status_code, (200, 204))
        product.refresh_from_db()
        return product

    def test_delete_through_product_api_records_deleter_and_timestamp(self):
        """The trash entry must know WHO deleted it, not just that it is gone."""
        product = self._delete_product_through_api()

        self.assertTrue(product.is_deleted)
        self.assertIsNotNone(product.deleted_at)
        self.assertEqual(product.deleted_by_id, self.admin.id)

        listing = self.client.get(f'{TRASH_BASE}?type=product')
        entries = {
            e['_id']: e for e in listing.data['data']['results']
            if e['type_key'] == 'product'
        }
        self.assertIn(str(product._id), entries)
        self.assertEqual(entries[str(product._id)]['deleted_by'], self.admin.username)

    def test_delete_through_product_api_stamps_cascaded_children(self):
        """Variants/stock rows use queryset.update(), so deleted_at is explicit."""
        self._delete_product_through_api()

        variant = ProductVariant.objects.get(pk=self.variant.pk)
        stock = StockItem.objects.get(pk=self.stock.pk)
        self.assertTrue(variant.is_deleted)
        self.assertIsNotNone(variant.deleted_at)
        self.assertEqual(variant.deleted_by_id, self.admin.id)
        self.assertTrue(stock.is_deleted)
        self.assertIsNotNone(stock.deleted_at)

    def test_dependency_report_counts_cascade_rows(self):
        product = self._soft_delete_product_graph()
        resp = self.client.get(f'{TRASH_BASE}product/{product._id}/dependencies/')
        self.assertEqual(resp.status_code, 200)
        data = resp.data['data']
        self.assertTrue(data['can_purge'])
        self.assertEqual(data['blocked_by'], [])

        by_model = {d['model']: d for d in data['dependencies']}
        self.assertEqual(by_model['inventory.ProductVariant']['count'], 1)
        self.assertEqual(by_model['inventory.StockItem']['count'], 1)
        self.assertEqual(by_model['inventory.ProductVariant']['soft_deleted'], 1)
        self.assertEqual(data['total_related'], 2)

    def test_permanent_delete_removes_the_whole_graph(self):
        product = self._soft_delete_product_graph()
        resp = self.client.delete(f'{TRASH_BASE}product/{product._id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])
        self.assertEqual(resp.data['data']['related_removed'], 2)

        self.assertFalse(Product.objects.filter(pk=self.product.pk).exists())
        self.assertFalse(ProductVariant.objects.filter(pk=self.variant.pk).exists())
        self.assertFalse(StockItem.objects.filter(pk=self.stock.pk).exists())

    def test_dependency_preview_does_not_delete_anything(self):
        product = self._soft_delete_product_graph()
        self.client.get(f'{TRASH_BASE}product/{product._id}/dependencies/')
        self.assertTrue(Product.objects.filter(pk=self.product.pk).exists())
        self.assertTrue(ProductVariant.objects.filter(pk=self.variant.pk).exists())

    def test_permanent_delete_simple_row(self):
        brand = self.soft_delete(self.brand_a)
        resp = self.client.delete(f'{TRASH_BASE}brand/{brand._id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Brand.objects.filter(pk=self.brand_a.pk).exists())

    def test_permanent_delete_missing_entry_returns_400(self):
        resp = self.client.delete(f'{TRASH_BASE}brand/{uuid.uuid4()}/')
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(resp.data['success'])

    def test_cannot_purge_a_row_that_is_not_deleted(self):
        brand = self.obj(self.brand_b)
        resp = self.client.delete(f'{TRASH_BASE}brand/{brand._id}/')
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(Brand.objects.filter(pk=self.brand_b.pk).exists())

    def test_restore_returns_row_to_normal_lists(self):
        brand = self.soft_delete(self.brand_a)
        resp = self.client.post(f'{TRASH_BASE}brand/{brand._id}/restore/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['data']['restored'])

        brand.refresh_from_db()
        self.assertFalse(brand.is_deleted)
        self.assertIsNone(brand.deleted_at)
        self.assertIsNone(brand.deleted_by)

        listing = self.client.get(TRASH_BASE)
        self.assertEqual(listing.data['data']['count'], 0)

    def test_restore_missing_entry_returns_400(self):
        resp = self.client.post(f'{TRASH_BASE}brand/{uuid.uuid4()}/restore/')
        self.assertEqual(resp.status_code, 400)

    def test_empty_trash_purges_everything(self):
        self.soft_delete(self.brand_a)
        self.soft_delete(self.category)
        resp = self.client.delete(TRASH_BASE)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data']['purged'], 2)
        self.assertFalse(Brand.objects.filter(pk=self.brand_a.pk).exists())
        self.assertFalse(Category.objects.filter(pk=self.category.pk).exists())

    def test_empty_trash_reports_when_already_empty(self):
        resp = self.client.delete(TRASH_BASE)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data']['purged'], 0)
        self.assertIn('already empty', resp.data['message'])

    def test_empty_trash_scoped_to_one_type(self):
        brand = self.soft_delete(self.brand_a)
        category = self.soft_delete(self.category)

        # Django's test client puts DELETE `data` in the body, not the query
        # string, so the type filter has to be part of the URL.
        resp = self.client.delete(f'{TRASH_BASE}?type=brand')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data']['purged'], 1)

        self.assertFalse(Brand.objects.filter(pk=brand.pk).exists())
        self.assertTrue(Category.objects.filter(pk=category.pk).exists())

    def test_empty_trash_unknown_type_returns_404(self):
        resp = self.client.delete(f'{TRASH_BASE}?type=nope')
        self.assertEqual(resp.status_code, 404)


# ─────────────────────────────────────────────────────────────────────────────
# 5. 30-day retention
# ─────────────────────────────────────────────────────────────────────────────

class TrashRetentionTestCase(TrashFixtureMixin, BaseTestCase):

    def setUp(self):
        super().setUp()
        self.client = self.auth_client(self.admin)

    def test_expiry_metadata_uses_retention_window(self):
        deleted_at = timezone.now() - timedelta(days=10)
        self.soft_delete(self.brand_a, when=deleted_at)
        entry = self.client.get(TRASH_BASE).data['data']['results'][0]
        self.assertEqual(entry['days_left'], 20)
        self.assertFalse(entry['is_expired'])

    def test_purge_expired_deletes_only_old_rows(self):
        old = self.soft_delete(self.brand_a, when=timezone.now() - timedelta(days=31))
        recent = self.soft_delete(self.brand_b, when=timezone.now() - timedelta(days=29))

        resp = self.client.post(TRASH_BASE + 'purge-expired/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data']['purged'], 1)
        self.assertEqual(resp.data['data']['by_type'], {'brand': 1})

        self.assertFalse(Brand.objects.filter(pk=old.pk).exists())
        self.assertTrue(Brand.objects.filter(pk=recent.pk).exists())

    def test_purge_expired_boundary_is_exclusive(self):
        """Exactly 30 days old is not yet expired; 30d + 1s is."""
        self.soft_delete(self.brand_a, when=timezone.now() - timedelta(days=30, seconds=-30))
        self.soft_delete(self.brand_b, when=timezone.now() - timedelta(days=30, seconds=30))
        resp = self.client.post(TRASH_BASE + 'purge-expired/')
        self.assertEqual(resp.data['data']['purged'], 1)
        self.assertTrue(Brand.objects.filter(pk=self.brand_a.pk).exists())
        self.assertFalse(Brand.objects.filter(pk=self.brand_b.pk).exists())

    def test_purge_expired_noop_message(self):
        self.soft_delete(self.brand_a, when=timezone.now() - timedelta(days=1))
        resp = self.client.post(TRASH_BASE + 'purge-expired/')
        self.assertEqual(resp.data['data']['purged'], 0)
        self.assertIn('Nothing to purge', resp.data['message'])

    def test_celery_task_purges_across_companies(self):
        from .trash.tasks import purge_expired_trash

        other_company = Company.objects.create(
            name='Task Co', short_name='TK', city='Multan', country='Pakistan',
            email='task@company.com',
        )
        other_brand = Brand.objects.create(
            name='Task Brand', code='TKB', company_id=other_company.id,
        )
        mine = self.soft_delete(self.brand_a, when=timezone.now() - timedelta(days=45))
        theirs = self.soft_delete(other_brand, user=self.admin,
                                  when=timezone.now() - timedelta(days=45))

        result = purge_expired_trash()

        self.assertEqual(result['purged'], 2)
        self.assertEqual(result['errors'], [])
        self.assertFalse(Brand.objects.filter(pk=mine.pk).exists())
        self.assertFalse(Brand.objects.filter(pk=theirs.pk).exists())

    def test_celery_task_skips_rows_inside_window(self):
        from .trash.tasks import purge_expired_trash

        self.soft_delete(self.brand_a, when=timezone.now() - timedelta(days=5))
        result = purge_expired_trash()
        self.assertEqual(result['purged'], 0)
        self.assertTrue(Brand.objects.filter(pk=self.brand_a.pk).exists())

    def test_retention_days_is_configurable(self):
        from django.test import override_settings

        with override_settings(TRASH_RETENTION_DAYS=7):
            self.assertEqual(services.retention_days(), 7)
            self.soft_delete(self.brand_a, when=timezone.now() - timedelta(days=8))
            resp = self.client.post(TRASH_BASE + 'purge-expired/')
            self.assertEqual(resp.data['data']['retention_days'], 7)
            self.assertEqual(resp.data['data']['purged'], 1)

    def test_task_is_registered_with_beat_schedule(self):
        from config.celery import app as celery_app

        self.assertIn('compsetting.purge_expired_trash', celery_app.tasks)
        schedule = celery_app.conf.beat_schedule
        self.assertIn('trash-retention-purge-daily', schedule)
        self.assertEqual(
            schedule['trash-retention-purge-daily']['task'],
            'compsetting.purge_expired_trash',
        )


# ─────────────────────────────────────────────────────────────────────────────
# 6. Permissions
# ─────────────────────────────────────────────────────────────────────────────

class TrashPermissionTestCase(TrashFixtureMixin, BaseTestCase):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        from django.contrib.auth import get_user_model
        User = get_user_model()
        cls.no_perm_user = User.objects.create_user(
            username='noperm', email='noperm@test.com', password='testpass123',
            company=cls.company, branch=cls.branch, role='STAFF',
        )
        cls.view_only_user = User.objects.create_user(
            username='viewonly', email='viewonly@test.com', password='testpass123',
            company=cls.company, branch=cls.branch, role='STAFF',
        )
        grant_trash_permissions(cls.view_only_user, 'view')

    def setUp(self):
        super().setUp()
        cache.clear()

    def test_user_without_permission_is_denied(self):
        client = self.auth_client(self.no_perm_user)
        self.assertEqual(client.get(TRASH_BASE).status_code, 403)
        self.assertEqual(client.get(TRASH_BASE + 'summary/').status_code, 403)

    def test_view_only_cannot_delete_or_restore(self):
        brand = self.soft_delete(self.brand_a)
        client = self.auth_client(self.view_only_user)

        self.assertEqual(client.get(TRASH_BASE).status_code, 200)
        self.assertEqual(len(client.get(TRASH_BASE).data['data']['results']), 1)

        delete_resp = client.delete(f'{TRASH_BASE}brand/{brand._id}/')
        self.assertEqual(delete_resp.status_code, 403)
        self.assertTrue(Brand.objects.filter(pk=brand.pk).exists())

        restore_resp = client.post(f'{TRASH_BASE}brand/{brand._id}/restore/')
        self.assertEqual(restore_resp.status_code, 403)

        empty_resp = client.delete(TRASH_BASE)
        self.assertEqual(empty_resp.status_code, 403)

        purge_resp = client.post(TRASH_BASE + 'purge-expired/')
        self.assertEqual(purge_resp.status_code, 403)

    def test_company_admin_short_circuits(self):
        self.assertTrue(services.can_purge(self.admin, TRASH_BY_KEY['brand']))
        self.assertTrue(services.can_view_type(self.admin, TRASH_BY_KEY['brand']))
        self.assertEqual(self.auth_client(self.admin).get(TRASH_BASE).status_code, 200)

    def test_restore_permission_is_separate_from_delete(self):
        user = self.view_only_user
        grant_trash_permissions(user, 'view', 'restore')
        brand = self.soft_delete(self.brand_a)
        client = self.auth_client(user)

        self.assertEqual(client.post(f'{TRASH_BASE}brand/{brand._id}/restore/').status_code, 200)
        self.assertEqual(client.delete(f'{TRASH_BASE}brand/{brand._id}/').status_code, 403)

    def test_unauthenticated_is_401(self):
        self.assertEqual(APIClient().get(TRASH_BASE).status_code, 401)


# ─────────────────────────────────────────────────────────────────────────────
# 7. Registry integrity
# ─────────────────────────────────────────────────────────────────────────────

class TrashRegistryTestCase(TestCase):

    def test_every_entry_has_the_required_fields(self):
        for tm in TRASH_MODELS:
            with self.subTest(type=tm.key):
                model = tm.model
                names = {f.name for f in model._meta.get_fields()}
                self.assertIn('is_deleted', names)
                self.assertIn('deleted_at', names)
                self.assertIn('deleted_by', names)
                self.assertIn('_id', names)
                self.assertIn('company_id', names)
                for field_path in tm.label_fields:
                    root = field_path.split('__')[0]
                    self.assertTrue(
                        root in names or hasattr(model, root),
                        f'{tm.model_label}.{root} referenced by {tm.key} does not exist',
                    )

    def test_keys_are_unique(self):
        keys = [tm.key for tm in TRASH_MODELS]
        self.assertEqual(len(keys), len(set(keys)))

    def test_unknown_key_returns_none(self):
        self.assertIsNone(services.get_trash_model('nope'))
        self.assertIsNone(services.get_trash_model(''))

    def test_display_name_never_raises_on_empty_labels(self):
        tm = TRASH_BY_KEY['brand']
        brand = Brand(name='', code='')
        brand._id = uuid.uuid4()
        name = build_display_name(tm, brand)
        self.assertTrue(name)
