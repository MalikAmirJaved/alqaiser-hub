# Bugs Found & Resolved — Al Qaiser Nexus ERP

> Living log of defects. Add a new entry for every meaningful fix.  
> Also summarize user-facing fixes in [`../CHANGELOG.md`](../CHANGELOG.md).

---

## How to log a bug

Use this template:

```md
### BUG-YYYYMMDD-NN — Short title
| Field | Value |
| ----- | ----- |
| Status | Open / In Progress / Resolved |
| Severity | Critical / High / Medium / Low |
| Module | HR / Inventory / Finance / Sales / Auth / Frontend / ... |
| Found | date + how (QA / prod / code review) |
| Resolved | date + PR/commit if available |
| Root cause | one paragraph |
| Fix | what changed (files/behavior) |
| Prevention | test or convention to avoid regression |
```

---

## Resolved

### BUG-20261010-09 — Deleted products still listed on Inventory → Stock Management
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Inventory / Stock |
| Found | 2026-10-10 (reported: deleted items showing on `/inventory/stock`) |
| Resolved | 2026-10-10 (changelog 1.6) |
| Root cause | `StockManagementViewSet` inherits `CompanyBranchMixin`, whose `get_queryset()` is the only place that applies `is_deleted=False`. But `current_stock` (the endpoint behind the Stock Management page) builds its own queryset with `StockItem.objects.filter(company_id=…)`, bypassing the mixin entirely — and `is_deleted` was never added. The page therefore listed soft-deleted products, and their quantities were included in the "Total Units On Hand" / "Low Stock Items" KPI cards because those are summed from the returned page. Verified against live data: the endpoint returned 1 of 1 stock rows, and that row had `stock.is_deleted=True`, `variant.is_deleted=True`, `product.is_deleted=True`. |
| Fix | Added `alive_stock()` / `alive_variant()` scoping helpers on the viewset and applied them across the module: `current_stock`, `retrieve`, `variant_summary`, `pos_catalog` (including every `Exists()` subquery), `batch_stock`, and `adjust`. The helpers filter `is_deleted=False` on the stock row **and** `variant__is_deleted=False` / `variant__product__is_deleted=False`, so a half-cascaded delete (parent soft-deleted, child rows missed) cannot leak either. `adjust` now refuses with a clear message instead of silently resurrecting a deleted variant through `get_or_create`, and the `current_stock`/`batch_stock` cache keys were version-bumped (`_v2`) so previously cached responses cannot keep serving deleted rows. |
| Prevention | `apps/inventory/tests.py → StockSoftDeleteTest` (11 tests) seeds a live and a deleted product graph and asserts the deleted one is absent from `current_stock` (plain, low-stock, search, and variant-id filters), `retrieve` (404), `variant_summary` (404, and a live variant whose stock row was deleted reports zero), `pos-catalog`, and `batch-stock` (deleted variant reports 0 units, not 199), plus that `adjust` refuses and that `alive_stock()` catches the half-cascaded case. |

### BUG-20261010-08 — "Permanently deleted 0 item(s)… 1 item(s) could not be deleted"
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Settings / Trash |
| Found | 2026-10-10 (reported from the running app; server log showed the ProtectedError) |
| Resolved | 2026-10-10 (changelog 1.6) |
| Root cause | Two compounding faults. (1) The PROTECT pre-flight `protected_relations()` only inspected the *root* object's reverse relations. A `Product` has no PROTECT rows pointing at it, but its `ProductVariant` is referenced by `InventoryTransaction.variant`, `CustomerInvoiceLine.variant`, `StockTransfer`, `PurchaseOrderLine`, `SalesOrderLine`, `ReturnRefundLine`, `InvoiceLineProductLink` and `QuoteLine` — all `on_delete=PROTECT`. So the check passed, the purge started, and `ProtectedError` was raised deep inside the cascade. (2) Because the purge runs in `transaction.atomic()`, that error marked the transaction broken; every subsequent item in the bulk loop then failed with the same opaque message, so "Empty trash" reported *"Permanently deleted 0 item(s) from the trash. 1 item(s) could not be deleted."* with no indication of what was holding the record. |
| Fix | `protected_relations()` now walks the entire CASCADE graph (`_collect_blockers`, capped at `MAX_DEPENDENCY_DEPTH`) and reports each blocker with the child model that owns the FK, so a Product's blocker is attributed to `inventory.ProductVariant`. `purge_entry()` raises a `TrashOperationError` carrying the blocker list *before* opening a transaction, so nothing is partially deleted. Bulk actions (`empty_trash`, `purge_expired`) now count `blocked` separately from `errors` and return human-readable `blockers`; the API message names the item and the exact references ("still referenced by 2 Inventory Transaction, 1 Customer Invoice Line. Those records must be removed first."). The summary exposes `blocked` + `blocked_samples`, the page shows an amber warning explaining that such rows can never age out, and the dependency-preview modal already rendered "Cannot delete yet". |
| Prevention | `TrashProtectedRelationTestCase` (9 tests) covers recursive blocker discovery, `can_purge=False` in the preview, purge refusing while leaving product/variant/stock rows untouched, `empty_trash` reporting `blocked=1, errors=[]` with an explanatory message, the summary count, success once the blocker is removed, and `format_blockers` wording/truncation. |

### BUG-20261010-07 — Editing a variant attribute crashed with a duplicate-key error
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Inventory / Products (variants) |
| Found | 2026-10-10 (writing the soft-delete regression test for attribute replacement) |
| Resolved | 2026-10-10 (changelog 1.6) |
| Root cause | `VariantAttribute` is `unique_together = [['variant', 'attribute_key']]`. `ProductVariantSerializer.update()` soft-deleted every existing attribute and then inserted the incoming ones — but a soft-deleted row still occupies the unique index, so re-sending an existing key (for example `Color`) raised `IntegrityError: UNIQUE constraint failed`. Any user editing a variant and keeping an attribute key hit a 500. The bug was latent because the app has no attribute data yet; adding `deleted_at` bookkeeping to the replace path made it reproducible. |
| Fix | `_create_attributes` now upserts by key: it looks up the row (including a soft-deleted one), revives it (`is_deleted=False`, clears `deleted_at`/`deleted_by`) and updates the value in place; only genuinely new keys are inserted. A key repeated in one payload updates the same row instead of colliding. The model's `Meta` now warns that soft-deleted rows hold the constraint, so callers must upsert. |
| Prevention | `SoftDeleteQuerysetTestCase.test_variant_attribute_edit_upserts_instead_of_colliding` edits an attribute and asserts a single row survives with the new value, plus `..._image_replace_records_deleter` for the image path (which has no unique key and legitimately soft-deletes + creates). |

### BUG-20261010-06 — Rows stored as deleted were invisible to Trash *and* the retention purge
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Settings / Trash, Inventory |
| Found | 2026-10-10 (reported: `deleted_at` was NULL on rows that already had `is_deleted=True`) |
| Resolved | 2026-10-10 (changelog 1.6) |
| Root cause | `deleted_at` was introduced after these rows were written, so rows flagged deleted earlier — imported as deleted, or soft-deleted through `queryset.update()` — kept `deleted_at = NULL`. The Trash module treats `NULL` as "never deleted by a user" and hides them, and the retention purge only touches rows that have a timestamp. Those rows were therefore stuck in permanent limbo: still reserving unique constraints (a soft-deleted SKU blocks re-import, `VariantAttribute`'s unique key blocks edits) but impossible to review, restore, or clean up. The live database had 60 such rows: 20 `inventory.Product`, 20 `ProductVariant`, 20 `StockItem`, all imported as deleted with no `DELETE` audit entry. |
| Fix | Added `apps/compsetting/trash/backfill.py` plus a data migration in each of the 10 affected apps that stamps `deleted_at = updated_at` (the row's real last-modified instant) for every `is_deleted=True, deleted_at IS NULL` row. `deleted_by` is deliberately left NULL because no user performed those deletions; the API renders a missing deleter as "Unknown (legacy)". The backfill is idempotent and supports `dry_run`. It restored all 60 rows to the trash, where they now age out or can be purged on demand. |
| Prevention | `TrashBackfillTestCase` covers stamping, `deleted_by` staying NULL, live rows being untouched, backfilled rows becoming visible *and* purgeable, idempotency, and dry-run. |

### BUG-20261010-05 — Product delete never recorded who deleted it
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | Medium |
| Module | Inventory / Products, Settings / Trash |
| Found | 2026-10-10 (end-to-end test: deleted a product over HTTP and checked the trash entry) |
| Resolved | 2026-10-10 (changelog 1.5) |
| Root cause | `ProductViewSet.destroy()` set `product.is_deleted = True` and saved with `update_fields=['is_deleted']`, never touching `deleted_by`. The cascade branch was no better: it soft-deleted variants, stock items, attributes, images, and reservations with bare `queryset.update(is_deleted=True)`, which bypasses `Model.save()`. The Trash module filters on `deleted_by IS NOT NULL` (so seeded demo rows with `is_deleted=True` never surface), so a deleted product showed up with an empty "Deleted by" column, and its child rows carried no deletion timestamp at all. |
| Fix | `destroy()` now stamps `deleted_by` and `deleted_at` on the product and passes `is_deleted`, `deleted_at`, and `deleted_by` to every cascade `update()`. |
| Prevention | `TrashPurgeTestCase.test_delete_through_product_api_records_deleter_and_timestamp` and `..._stamps_cascaded_children` delete through the real inventory endpoint and assert the deleter and timestamps on the product, its variant, and its stock row. |

### BUG-20261010-04 — `deleted_at` was set in ~20 views but never persisted
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Backend / Common (`BaseModel`) |
| Found | 2026-10-10 (building the Settings → Trash module) |
| Resolved | 2026-10-10 (changelog 1.5) |
| Root cause | `deleted_at` was declared only on `compsetting.TimeStampedModel` (6 tables). `apps.common.basemodel.BaseModel` had `is_deleted` and `deleted_by` but no `deleted_at`, so the ~20 views that did `instance.deleted_at = timezone.now()` (HR employee/asset/policy/leave/payroll/exit, notifications, …) were setting a plain Python attribute — the value was never written and no retention rule could be based on it. |
| Fix | `deleted_at` now lives on `BaseModel` (and on `organization.User`, which extends `AbstractUser` rather than `BaseModel`). `save()` stamps it when `is_deleted` flips to True and clears `deleted_at`/`deleted_by` on restore, including when callers pass `update_fields=['is_deleted']`. A backfill stamped legacy rows that had a real `deleted_by`; seed rows with `is_deleted=True` and no deleter were deliberately skipped so they never enter the trash. |
| Prevention | `DeletedAtTestCase` covers stamping, `update_fields`, re-save idempotence, restore, the `User` model, and the documented `queryset.update()` limitation. |

### BUG-20261010-03 — Cascade-preview walked the wrong relations and always reported zero
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | Medium |
| Module | Settings / Trash |
| Found | 2026-10-10 (self-test of permanent delete on a product graph) |
| Resolved | 2026-10-10 (changelog 1.5) |
| Root cause | The dependency scan iterated `model._meta.get_fields()` and kept concrete `many_to_one`/`one_to_one` fields, i.e. the row's *forward* foreign keys. Those are the audit pointers (`created_by`, `updated_by`, `deleted_by`) and optional links (`category`, `brand`) — all `SET_NULL` — while the rows that genuinely cascade (`Product ← ProductVariant ← StockItem`) are *reverse* relations, which the filter discarded. The confirmation dialog therefore always claimed "0 related records" before a destructive purge. |
| Fix | Replaced the scan with a recursive walk over `model._meta.related_objects` filtered to `remote_field.on_delete is CASCADE`, aggregating counts per model and reporting how many are already soft-deleted. `on_delete=PROTECT` relations are surfaced separately as `blocked_by`, and permanent delete refuses with a clear message instead of throwing an `IntegrityError` mid-transaction. Deletion now proceeds deepest-first via `_process_relations`. |
| Prevention | `TrashPurgeTestCase` asserts a 1-variant/1-stock graph reports 2 dependencies and that purging removes product, variant, and stock rows. |

### BUG-20261010-02 — Trash API authorised the wrong action for restore and purge
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Settings / Trash, Permissions |
| Found | 2026-10-10 (self-test: a user granted `view` + `restore` got 403 on restore) |
| Resolved | 2026-10-10 (changelog 1.5) |
| Root cause | `PermissionRequiredMixin.get_permission_action()` looks for `self.action` (a ViewSet concept). These endpoints are plain `APIView`s, so it fell through `permission_action_map` (which is only consulted with `viewset_action` as the key, never the HTTP method) and `VIEWSET_ACTION_TO_PERMISSION` to the `HTTP_METHOD_TO_ACTION` fallback — resolving `POST` to `create` and typing every non-safe method to the same action. Restore demanded `SETTINGS:trash:create`, which is not seeded, so only superusers succeeded. |
| Fix | `BaseTrashView` declares a `required_action` and overrides `get_permission_action()` to return it; `TrashListView`/`TrashEntryView` pick `view` for GET and `delete` otherwise, and restore declares `restore`. The per-action `_require_permission()` check remains as a second, independent gate, and each type also honours its own module's `delete`/`update` permission as a fallback. |
| Prevention | `TrashPermissionTestCase` asserts a view-only user can list but not delete/restore/purge, and that granting `view` + `restore` allows restore while still forbidding permanent delete. |

### BUG-20261010-01 — Conflict policies ignored quantity; skipped rows looked uneditable
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | Medium |
| Module | Inventory / Import |
| Found | 2026-10-10 (product review of the 1.4 import flow) |
| Resolved | 2026-10-10 (changelog 1.4, Changed) |
| Root cause | The conflict policies only covered descriptive fields: there was no quantity input anywhere in the Review & Edit modal or the confirm payload, `_update_variant` read a `quantity_on_hand` key that no client sent (so the "add to stock" branch was dead code), and `_create_variant_for` always wrote `StockItem(quantity_on_hand=0)`. Under **Skip Duplicates** the dimmed conflicting rows carried no explanation and looked disabled. |
| Fix | Added an editable **Qty** column to the modal (`quantity_on_hand` on `ImportRow`; `null` = leave stock alone). **Update Existing** adds it to the stock on hand (80 + 20 = 100); **Replace Existing** sets stock to it (80 → 20); created rows use it as opening stock. Stock writes go to the default warehouse through a locked `StockItem` row, bump `version`, and append an `InventoryTransaction` (`ADD_STOCK` / `ADJUSTMENT` / `INITIAL`, `source_document_type='PRODUCT_IMPORT'`). Negative quantities are rejected as structural errors. Skipped rows are dimmed **and** labelled `Skipped` while staying editable (full opacity on hover/focus), and the modal shows the resulting balance next to the Qty cell. |
| Prevention | `apps/inventory/tests_import.py` covers add/set/blank quantity per policy, ledger rows, `version` bumps, the default-warehouse target, and the negative-quantity 422. |

### BUG-20261009-02 — Product import did not identify the existing product for a duplicate SKU
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Inventory / Import |
| Found | 2026-10-09 (QA) |
| Resolved | 2026-10-09 (changelog 1.4) |
| Root cause | The parse/confirm import path never queried `ProductVariant` by SKU; the only signal was a raw `IntegrityError` with no record identity. |
| Fix | Added batched server-side duplicate resolution (`_resolve_duplicates`, `_existing_variant_map`) scoped to company+branch; parse/validate responses now include existing product/variant/category/brand/warehouse metadata, distinguishing DB conflicts, within-file duplicates, and soft-deleted SKUs. |
| Prevention | `apps/inventory/tests_import.py` covers DB/within-file/soft-delete/tenant/case behavior. |

### BUG-20261009-03 — Product import lacked conflict-resolution options
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Inventory / Import |
| Found | 2026-10-09 (QA) |
| Resolved | 2026-10-09 (changelog 1.4) |
| Root cause | The confirm endpoint accepted only `rows`/`source` and always created new records; the modal offered only "Confirm & Create". |
| Fix | Added `conflict_policy` (Add New / Update Existing / Skip Duplicates / Replace Existing) enforced server-side, plus a policy selector with effect summary in the Review & Edit modal. Update/Replace are non-destructive in-place updates that preserve stock, IDs, images, attributes, and historical FKs. |
| Prevention | Policy tests in `apps/inventory/tests_import.py` assert fields, counters, and stock/ID preservation. |

### BUG-20261009-04 — Technical database errors shown to users on duplicate SKU
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | Medium |
| Module | Inventory / Import |
| Found | 2026-10-09 (QA) |
| Resolved | 2026-10-09 (changelog 1.4) |
| Root cause | `ProductImportConfirmView` returned `f'DB constraint: {e}. Nothing was created.'` including raw PostgreSQL constraint text, rendered verbatim by the modal. |
| Fix | Conflicts are detected before writes and returned as friendly row-scoped `errors`; unexpected `IntegrityError` is caught (with savepoints for Skip Duplicates) and logged server-side via `logger.exception`, never returned. |
| Prevention | `ImportNoRawDbErrorTest` asserts no raw DB text in messages; transaction/savepoint model documented in `doc/plan.md` §6.1. |

### BUG-20260721-01 — User update returns 400 when department/designation omitted
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Settings / Users |
| Found | 2026-07-21 |
| Resolved | 2026-07-21 (changelog 1.3) |
| Root cause | Empty department/designation values were submitted and failed validation on update. |
| Fix | Strip empty values before submit; COMPANY_ADMIN no longer required to set department/designation; fields hidden for that role. |
| Prevention | Treat optional FKs as omit-on-empty in user forms; cover update-without-reselect in API/UI tests. |

### BUG-20260721-02 — Username not editable on user update
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | Medium |
| Module | Settings / Users |
| Found | 2026-07-21 |
| Resolved | 2026-07-21 |
| Root cause | Username treated as immutable in update UI/API path. |
| Fix | Username field made editable on update. |
| Prevention | Explicit product rule: username updatable unless uniqueness conflict. |

### BUG-20260721-03 — Product import parse crashes on pandas NaN
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Inventory / Import |
| Found | 2026-07-21 |
| Resolved | 2026-07-21 |
| Root cause | `_resolve_brand_or_category` assumed strings; pandas returned `float('nan')`. |
| Fix | Normalize NaN/empty before brand/category resolution. |
| Prevention | Always sanitize spreadsheet cells before string ops; add import fixture with blank brand/category. |

### BUG-20260721-04 — Non-JSON error responses break frontend handling
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | Medium |
| Module | Frontend / `apiFetch` |
| Found | 2026-07-21 |
| Resolved | 2026-07-21 |
| Root cause | Client assumed all error bodies were JSON. |
| Fix | Graceful fallback messaging for non-JSON responses. |
| Prevention | Keep `apiFetch` error path defensive; never assume Content-Type. |

### BUG-20260720-01 — Finance vendor / supplier billing defects
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Finance / Supplier Bills |
| Found | 2026-07-20 |
| Resolved | 2026-07-20 (changelog 1.2) |
| Root cause | Billing flow edge cases around vendor bills (see finance vendor billing work). |
| Fix | Corrected supplier bill management behavior in finance module. |
| Prevention | Regression checks for create/update/pay supplier bills. |

### BUG-2026-INV-01 — Invoice cancel / edit / return disposition inconsistency
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | Critical |
| Module | Finance / Inventory (manual + variant lines) |
| Found | Pre-2026-07 (commit `e85c29e` lineage) |
| Resolved | Unified disposition for cancel/edit/return for manual and variant lines. |
| Root cause | Manual lines and variant lines followed different cancel/edit/return paths. |
| Fix | Unified invoice cancel/edit/return disposition across line types. |
| Prevention | Shared service path for invoice line disposition; cover both line kinds in tests. |

### BUG-2026-POS-01 — POS UX defects
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | Medium |
| Module | Inventory / POS |
| Found | Pre-2026-07 |
| Resolved | POS UX fixes + later POS → invoice integration (1.2). |
| Root cause | UX and integration gaps in cart/sale completion. |
| Fix | POS UX fixes; sales attach to invoices/accounting. |
| Prevention | Manual POS smoke: sale → stock → invoice. |

---

## Open / Known (track until closed)

| ID | Issue | Module | Severity | Notes |
| -- | ----- | ------ | -------- | ----- |
| TECH-01 | Dual CRUD systems (`CrudPage` vs `DynamicModulePage`) | Frontend | Medium | New work must use modern React Query pattern |
| TECH-02 | Mixed `.jsx` / `.tsx` | Frontend | Low | Migrate on touch |
| SEC-01 | Login forgot-password hardcodes hint | Auth UI | Critical | Remove/replace before production |
| SEC-02 | Default seed admin password in env | Auth | High | Change immediately after first login |
| OPS-01 | Celery not auto-started with Daphne | Ops | Medium | Start worker+beat separately (`backend/cmd`) |
| TECH-03 | Duplicate finance forecast routes (`forecast` + `forecasting`) | Finance UI | Low | Remove dead route |
| TECH-04 | Dual inventory audit engines | Inventory / Audit | Medium | Consolidate long-term |
| TECH-05 | `DASHBOARD` permission module not in seed | Overall dashboard | Medium | Works via fallbacks; register properly |
| TECH-06 | Loose TS/ESLint (`noImplicitAny` off, etc.) | Frontend | Low | Tighten for production |
| OPS-02 | Docker removed from repo | Ops | Info | Documented in setup; local services required |

Source for technical debt: [`../agent.md`](../agent.md) § Known Issues.

---

## Triage checklist

When a bug is reported:

1. Reproduce with company/branch context and role (COMPANY_ADMIN vs STAFF).
2. Confirm whether it is tenancy, permission, validation, or UI-state.
3. Prefer backend atomic fix for data integrity; then align frontend.
4. Log here + CHANGELOG; update Known Issues if debt remains.
5. Add a regression note (manual or automated).

---

## Related

- [`../CHANGELOG.md`](../CHANGELOG.md)  
- [workflow.md](./workflow.md)  
- [`../agent.md`](../agent.md)  
