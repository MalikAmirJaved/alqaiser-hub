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

### BUG-20261012-04 — Purchase Order create 500'd on tax rates with more than 2 decimal places
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Inventory / Purchases |
| Found | 2026-10-12 (reported: `POST /api/inventory/purchase-orders/` → 500, server log showed `django.core.exceptions.ValidationError: {'tax_rate': ['Ensure that there are no more than 2 decimal places.']}`) |
| Resolved | 2026-10-12 (changelog 1.8) |
| Root cause | `PurchaseOrderSerializer` declares `line_items` as a write-only `ListField(child=DictField())`, so its per-line numbers never pass through any serializer field validation. `create()` read `tax_rate = line_data.get('tax_rate', 0)` and passed it verbatim to `PurchaseOrderLine.objects.create`. The model's `save()` deliberately calls `full_clean()`, and `tax_rate` is `DecimalField(max_digits=5, decimal_places=2)` — so any JSON number with more than 2 decimals (JS float noise such as `15.000000000000002` from cart arithmetic, or a typed `15.555`) raised `ValidationError` inside the view with no DRF handler, producing a 500 instead of a saved order. `unit_cost` was already quantized in the same loop; `tax_rate` was the only raw numeric left. |
| Fix | `create()` now coerces and quantizes the rate to 2dp with `ROUND_HALF_UP` — the same treatment `unit_cost` receives — and uses that quantized value for both `line_tax(...)` in the order total and the `PurchaseOrderLine` insert, so the stored rate and the stored `total_amount` cannot drift. `SalesOrderLine` was checked for the same exposure: it has no `full_clean()`-on-save and its unit price allows 4dp, so POS sales were unaffected. |
| Prevention | `apps/inventory/tests.py → PurchaseOrderTaxPrecisionTest` (3 tests) POSTs to the real endpoint with `15.555` and a float artifact `7.500000000000001`, asserting 201 with the rate stored as `15.56` / `7.50`, and that `total_amount` equals the total recomputed from the stored quantized rate. |

### BUG-20261012-03 — Discount not shown on POS Recent Sales, thermal receipts, or the sales-order page
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | Medium |
| Module | Inventory / POS (frontend) |
| Found | 2026-10-12 (reported: discount missing on `/inventory/pos` Recent Sales tab, on thermal receipts, and on the sales-order detail page) |
| Resolved | 2026-10-12 (changelog 1.8) |
| Root cause | Three frontend faults around the same data. (1) `sales-orders/[id]` computed each line's discount from `l.discount_pct`, but `SalesOrderLineSerializer` returns `discount_percent` — the value was always `undefined`, so percent discounts (the kind POS writes, since the backend stores `discount_percent=discount_pct, discount_amount=discount_fixed`) rendered as “—” and `totalDiscount` stayed 0, hiding every Discount row and summary chip. The `SalesOrderResponse` hook type itself declared the *write* names (`discount_pct`/`discount_fixed`), which is why `tsc` never caught the mismatch. (2) The Recent Sales expandable table had no Discount column and subtracted only the fixed `discount_amount`, ignoring the percent. (3) Thermal receipts never displayed a discount: the Recent Sales thermal built line totals as `qty × price` with no deduction while the TOTAL used `order.total_amount` (already net of discount), so the rows could never sum to the total. |
| Fix | `useSalesOrder.ts` response type now mirrors the API (`discount_percent`, `discount_amount`; the write payload keeps `discount_pct`/`discount_fixed` as the backend reads those). The detail page reads `discount_percent` in all three sites (both reducers and the table row). Recent Sales gained a Discount column (`-X.XX` in red, “—” otherwise) whose line totals subtract percent discounts too, with the footer `colSpan` adjusted. `ThermalReceiptLine` gained an optional `discount_amount`; both renderers — the on-screen preview and the printed iframe HTML (`buildReceiptHtml`) — show `Discount -X.XX` under each discounted line. Both thermal builders (Recent Sales button and the POS cart's `buildThermalReceipt`) now pass the computed discount and keep line totals net of it. Following up on the same report: an overall (aggregate) Discount row now sits directly above the Total — `SalesOrder` has no order-level discount field (the POS cart's global discount is distributed into lines on submission), so it is the sum of the line discounts — shown in the Recent Sales expanded-table footer and on thermal receipts through a new optional `ThermalReceiptData.discountAmount`, rendered in both the preview and the printed HTML. |
| Prevention | The hook type now matches the serializer field list, so a future rename breaks `tsc` instead of silently rendering 0. Verified with `tsc --noEmit` (exit 0) and eslint (no new findings) on all five touched files. |

### BUG-20261012-02 — Test runner reported “ALL TESTS PASSED” while 4 tests failed
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Backend / Test infrastructure |
| Found | 2026-10-12 (stock `manage.py test` exited 1 with 4 failures right after the custom runner printed a green 562-test summary) |
| Resolved | 2026-10-12 (changelog 1.8) |
| Root cause | Two independent faults. (1) `config/test_runner.py` decided its verdict and exit code from a mix of result attributes while the printer counted `_all_results` — and it never consulted the subtest failure list, so CPython’s `addSubTest` failures (which record into `result.failures` per subtest via `test.failureException`, not `self.failureException`) were invisible to both the summary and `sys.exit`. The net effect: the runner printed “✓ ALL TESTS PASSED”, exited 0, and stock Django immediately reported **562 tests, 4 failures** on the same suite. (2) The 4 masked failures were a pre-existing bad assertion: `TrashRegistryTestCase` asserted `'company_id' in {f.name for f in model._meta.get_fields()}`, but 4 of the 27 registry models (`User`, `TermsAndCondition`, …) declare tenancy as `company = ForeignKey(...)`, whose field *name* is `company` while its *column* (`attname`) is `company_id`. An `IntegerField` literally named `company_id` has both, which is why the other 23 passed. |
| Fix | The runner now derives the verdict, counts and exit code from unittest’s own `failures` / `errors` / `skipped` / `expectedFailures` lists (which include subtest failures) instead of a parallel counter, and `_resolve_hierarchy` maps module paths so `tests_trash`, `tests_import`, `tests_totals` etc. are attributed to their app rather than “UNKNOWN”. The registry assertion now checks the **column** (`f.attname`), which is what tenant scoping actually filters on, and still asserts the other required fields on names. Verified: custom runner and stock runner agree — 562 tests, 0 failures, exit 0; the 4 subtests reproduced byte-identically at `HEAD` (commit `125a6b6`, via a clean worktree) before the fix. |
| Prevention | The runner can no longer disagree with unittest’s own bookkeeping because it *is* unittest’s bookkeeping. `TrashRegistryTestCase` runs green on all 27 models. **Going forward: if the runner’s summary and the exit code ever disagree, trust the exit code and fix the runner.** |

### BUG-20261012-01 — Sales order “Related returns” 500 (`ORDER BY` inside a compound statement)
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Inventory / Sales (returns) |
| Found | 2026-10-12 (endpoint test for `sales-orders/{_id}/related-returns`) |
| Resolved | 2026-10-12 (changelog 1.8) |
| Root cause | `SalesOrderViewSet.related_returns` built two querysets that each carried `.order_by("-created_at")`, combined them with `.union()`, and then applied a third `.order_by("-created_at")` on the compound result. In Django that compiles to a `UNION` whose operands are parenthesised subqueries containing their own `ORDER BY`, wrapped by an outer one — which PostgreSQL rejects with `ORDER BY not allowed in subqueries of compound statements`. Every sales order that opened the returns section 500’d. |
| Fix | The `UNION` was unnecessary: `ReturnRefund.document_id` is a plain UUIDField with `return_type` (`POS` / `INVOICE`) as the discriminator, so a single queryset filtered with `Q(return_type='POS', document_id=order._id) \| Q(return_type='INVOICE', document_id__in=invoice_ids)` (plus the existing tenant/`is_deleted` scope) returns exactly the same rows, with one `ORDER BY` and the same `(return_type, document_id)` index usage. No other `.union()` exists in the backend. |
| Prevention | `apps/inventory/tests.py → RelatedReturnsTest` creates one POS return and one invoice-linked return against a sales order and calls the endpoint over HTTP; it reproduced the SQL error before the fix and passes after. |

### BUG-20261010-11 — Document totals dropped per-line tax (PO / Quote / Invoice / Sales Order)
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | Critical |
| Module | Inventory / Sales / Finance (totals) |
| Found | 2026-10-10 (reported: "tax was not calculated with total after created" on Purchase Order, Quote and Invoice) |
| Resolved | 2026-10-10 (changelog 1.7) |
| Root cause | Every document summed only the **net** line amounts (`qty × price − discount`) and never applied each line's `tax_rate`, even though the forms and detail tables displayed that tax. `PurchaseOrderSerializer.create` read `tax_rate` off the payload and threw it away; `QuoteSerializer`/`CustomerInvoiceSerializer` (both `create` and `update`) computed `base + overall_tax` and omitted line tax entirely; the four `SalesOrder` total sites in `inventory/serializers/sales.py` and `inventory/views/sales.py` did the same. So a 100.00 order at 15% saved as 100.00 while the UI showed 115.00, and the invoice-sync helpers (`sync_sales_order_to_invoice`, `sync_invoice_for_return`, `return_refund_service._update_source_document_totals`) recomputed invoice amounts tax-free, silently stripping tax from POS-sourced invoices and after every return. The UI compounds it: the Invoice form printed a "Tax (line)" row but left it out of the Total it submitted, and the Quote form's `calculateTotal()` computed `totalTax` then never added it. |
| Fix | New single source of truth `backend/apps/common/totals.py` (`dec`, `line_net`, `line_tax`, `line_amount_with_tax`, `document_total`, `overall_discount_amount`, `overall_tax_amount`) implements the formula the UI already renders: `subtotal − line discounts − overall discount% + line tax + overall tax%`. All eleven total-writing sites now go through it: PO, Quote (create+update), CustomerInvoice (create+update), SalesOrder (serializer create, `_create_complete_order`, complete-with-modifications, edit), plus the three invoice-recompute paths. The `line_total` properties on `PurchaseOrderLine`/`QuoteLine`/`CustomerInvoiceLine`/`SalesOrderLine` now include line tax so row totals reconcile with their header total. Frontend: Quote form's `calculateTotal()` and Invoice form's `amount`/displayed Total now add `totalTax`; Quote, Invoice and print/PDF (`QuoteInvoiceDocument`) footers gained the missing *Discount (line)* and *Tax (line)* rows; Quote and PO detail tables gained a Tax column; POS thermal receipt uses the shared `cartTotal`/`lineTotal` helpers instead of its own tax-less sum. Also fixed as found: `PurchaseOrderLine.clean()` raised `models.ValidationError`, which does not exist on `django.db.models` — every PO-line validation failure would have 500'd with `AttributeError` instead of returning 400. |
| Prevention | `backend/apps/common/tests_totals.py` — 13 tests covering the helper math and end-to-end serializer `create`/`update` for all four document types, asserting the persisted total and that `sum(line.line_total) == header total`. Existing totals tests (which use `tax_rate=0`) still pass unchanged, so the formula degrades to the old behaviour when no line has tax. **Going forward: never hand-roll a document total — import from `apps.common.totals`.** Existing rows saved before this fix are intentionally left as-is (fix-forward); recompute them only with an explicit, reviewed backfill. |

### BUG-20261010-10 — "Cannot delete yet" dialog could not be closed
| Field | Value |
| ----- | ----- |
| Status | Resolved |
| Severity | High |
| Module | Settings / Trash (frontend) |
| Found | 2026-10-10 (reported: clicking the dialog's button did nothing) |
| Resolved | 2026-10-10 (changelog 1.6) |
| Root cause | When the cascade pre-check found PROTECT blockers, `TrashPurgeModal` relabelled the single action button to "Close" and hid the Cancel button (`showCancelButton={!blocked}`) — but left it wired to `onConfirm`. `ConfirmationModal` only closes when `onConfirm()` resolves, and its `catch` block merely logged the error. Clicking "Close" therefore re-dispatched the permanent delete, the server correctly refused it with 400, the promise rejected, `handleClose()` was never reached, and the dialog stayed open. The server log showed one `Trash empty/purge failed` warning per click. |
| Fix | When blocked, the action button now calls `onClose` (it is a real Close button, not a destructive one). The confirmation is additionally disabled while the dependency pre-check is still loading (`confirmDisabled`), so a delete can no longer be dispatched before the blockers are known — previously the button read "Delete forever" and was live during that window. As a safety net, `ConfirmationModal.handleConfirm` now closes on failure too: a rejected action can never trap the dialog, and the user still gets the API's error toast explaining why. The now-unused `TrashDependencySkeleton` export was removed. |
| Prevention | The blocked path is exercised by `TrashProtectedRelationTestCase.test_dependency_preview_reports_cannot_purge` (asserts `can_purge=False` and a non-empty `blocked_by`, which is what drives the Close-button state), and `test_purge_refuses_and_leaves_everything_intact` asserts the server rejects the request — the combination that previously left the dialog unclosable. |

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
