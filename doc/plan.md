# Product Import Bug Fixes — Investigation & Implementation Plan

## 1. Title and Status

> Project: **Al Qaiser Nexus ERP** (`nexuscrm`)
> Scope: **Bug 2 (duplicate SKU does not identify existing product)**, **Bug 3 (missing import conflict-resolution options)**, **Bug 4 (technical DB errors shown to users)**
> Status: **AWAITING USER REVIEW & APPROVAL**
> Revision: **UX revision (Review & Edit modal)** — see §3.5, §5.8–§5.10, §6.3.
> Implementation: **NOT STARTED.** This document is a plan only. No application source, test, migration, config, dependency, or database content has been changed by this task.

---

## 2. Executive Summary

Product import currently supports a parse → review → confirm flow but has three related defects in the duplicate-SKU path:

- **Bug 2 — No visibility into where a duplicate SKU lives.** The backend performs no duplicate lookup at all; duplicate detection happens only when the database rejects the insert. When that happens the client receives no product name, category, brand, branch, or warehouse for the existing SKU. The frontend only detects duplicates *within the uploaded file* (case-sensitive, exact match) and never checks against existing records.
- **Bug 3 — No conflict-resolution options.** There is exactly one behavior: create-or-fail. Rows are grouped by `product_name`, a new `Product` is always created, and any collision aborts the entire atomic import. There is no **Add New / Update Existing / Skip Duplicates / Replace Existing** policy, neither globally nor per row.
- **Bug 4 — Raw database errors reach the user.** The confirm view catches `IntegrityError` and returns `f'DB constraint: {e}. Nothing was created.'`, which includes the raw PostgreSQL constraint message (e.g. `duplicate key value violates unique constraint "inventory_product_variants_company_id_branch_id_sku_..."`). This is displayed verbatim in the review modal's "Server returned errors" list.

**Intended outcome:** duplicate SKUs are detected and explained *before* any write, the user chooses a clear conflict policy that the server validates and enforces atomically, and any residual database conflict is reported as a friendly, actionable, row-scoped message that never leaks SQL/stack/tenant internals.

**UX intent (this revision):** keep the existing upload → parse → **automatic Review & Edit modal** flow (`ImportUploadModal` + `ImportReviewModal`, opened by `page.tsx`); enrich the modal with per-variant conflict highlighting (red border **plus** icon/text), existing-record details, inline editing with server revalidation, and a visible conflict-policy selector. No second workflow or duplicate modal is introduced (see §5.8–§5.10).

---

## 3. Existing Architecture and Import Workflow

### 3.1 Frontend → backend flow (verified)

| Stage | Location | Behavior |
| ----- | -------- | -------- |
| Entry | `frontend/src/app/(app)/inventory/products/page.tsx` (`handleImportOpen`, `handleImportParsed`) | Opens `ImportUploadModal`; stores parsed rows + `source`. |
| Upload/parse | `frontend/src/components/inventory/product/ImportUploadModal.tsx` | Validates extension/size, POSTs the file, calls `onParsed(rows, source)`. |
| Hook | `frontend/src/hooks/useProductExportImport.ts` → `useImportParse`, `useImportConfirm` | `useImportParse` uses raw `fetch` (multipart); `useImportConfirm` uses `apiFetch` (`useApi`). |
| Parse API | `backend/apps/inventory/views/product_import_export.py` → `ProductImportParseView.post` (line 236) | Parses XLSX/XLS/CSV, builds a preview, returns rows. No duplicate detection. |
| Review UI | `frontend/src/components/inventory/product/ImportReviewModal.tsx` | Editable table grouped by product; client-side validation; `handleConfirm` (line 185). |
| Confirm API | `product_import_export.py` → `ProductImportConfirmView.post` (line 321) | Groups rows, creates products/variants/stock, returns counters. |
| Routes | `backend/apps/inventory/urls.py` lines 42–44 | `products/import/parse/`, `products/import/confirm/`, `products/import/template/`. |

> **Verified:** the Review & Edit modal **already opens automatically** once parsing finishes. `products/page.tsx` `handleImportParsed` (line 140) stores the parsed rows and closes `ImportUploadModal`, and `ImportReviewModal` is rendered with `open={importRows.length > 0}` (line 381). The required "upload → validate → automatic Review & Edit" workflow therefore needs **no new page or modal**; only the data returned to it and its contents change.

**API contracts (current):**

- `POST /api/inventory/products/import/parse/` → `{ status, message, data: { rows: ImportRow[], total_rows } }`
- `POST /api/inventory/products/import/confirm/` body `{ rows: ImportRow[], source }` → `{ status, message, data: { products_created, variants_created, brands_created, categories_created } }`
- On validation failure: HTTP **422** `{ status: 'error', message, errors: [{ row_index, error }] }`
- On DB conflict: HTTP **422** `{ status: 'error', message: "DB constraint: <raw>. Nothing was created.", errors: [{ row_index: null, error: "<raw>" }] }`

> Convention note: `docs/conventions.md` specifies mutation responses as `{ success, message, data }`, but the import views use `{ status, message, ... }`. This is a pre-existing inconsistency; the plan keeps `status` to avoid a breaking contract change (see §11).

### 3.2 Domain model and constraints (verified)

- `ProductVariant` (`backend/apps/inventory/models/variant.py`):
  - `sku = models.CharField(max_length=100)` — **not** blank/null.
  - `Meta.unique_together = [['company_id', 'branch_id', 'sku']]` (line 19) → uniqueness scope is **company + branch**, and the constraint applies to **soft-deleted rows too**, because `is_deleted` is not part of the constraint.
- `Product` (`backend/apps/inventory/models/product.py`): has `product_name`, `description`, `category` (FK), `brand` (FK), `unit`, `storage_requirement`, `tax_rate`, `status`, `source`, `is_active`; no SKU of its own.
- `StockItem` (`backend/apps/inventory/models/stock.py`): `unique_together = [['variant','warehouse']]`; holds `quantity_on_hand`/`quantity_reserved`. This is the warehouse context for "where the SKU is stored".
- `BaseModel` (`backend/apps/common/basemodel.py`): soft delete via `is_deleted`, `company_id`/`branch_id` integers, UUID `_id` for API lookups.

### 3.3 Tenant / permission / soft-delete rules (verified)

- Both import views extend `CompanyBranchMixin` + `PermissionRequiredMixin` with `permission_module='INVENTORY'`, `permission_resource='product'`.
- Confirm sets `company_id = user.company_id`, `branch_id = user.branch_id` directly — the import scope is the **user's own company and branch**. There is no cross-company or cross-branch import path.
- `CompanyBranchMixin.get_queryset` only affects ViewSet `get_queryset`; the import views query models directly, so any new lookup must add `company_id`/`branch_id`/`is_deleted=False` filters explicitly.
- Duplicate detection therefore must be scoped to the importing user's `company_id` + `branch_id`, which exactly matches the DB uniqueness scope.

### 3.4 SKU matching semantics (verified — Revision B)

The plan must match SKUs the way the database and the rest of the application do. Verified findings:

| Question | Verified answer | Evidence |
| -------- | --------------- | -------- |
| Is the DB SKU uniqueness case-sensitive? | **Yes, case-sensitive.** `unique_together = ('company_id','branch_id','sku')` is a plain `CharField`; there is no `CITEXT`, `db_collation`, or `Lower()`/functional unique index. PostgreSQL therefore treats `abc` and `ABC` as distinct values. | `apps/inventory/models/variant.py:6,19`; `apps/inventory/migrations/0002_initial.py` (`AlterUniqueTogether productvariant`); no citext/collation/`Lower` matches under `apps/`. |
| Is whitespace normalized? | **Partially.** The import path trims (`_build_preview` builds `variant_sku = str(...).strip()`; confirm does `(vrow.get('variant_sku') or '').strip()`). Manual create/update in `ProductViewSet` do **not** trim (`var_data.get('sku')` is stored as-is). | `product_import_export.py`; `views/product.py` `create`/`update`. |
| Does the app treat differently-cased SKUs as the same identifier? | **No.** Nothing casefolds SKUs: the parser preserves case, confirm preserves case, the frontend `seenSkus` is a case-sensitive `Set`, and manual create/update preserve case. | `ImportReviewModal.tsx:37-56`; `product_import_export.py`; `views/product.py`. |
| Would case-insensitive matching require a schema change? | A case-insensitive business rule enforced at the DB (`CITEXT` or `Lower('sku')` unique index) would require a **migration** → out of scope for this planning task and for the bug fix. | Files under `apps/inventory/migrations/`. |

**Conclusion / recommended default:** match on the **exact, trimmed SKU (case-sensitive)** — `sku=<imported trimmed value>` scoped to `company_id` + `branch_id`. This mirrors the database constraint and every application path. Case-insensitive (`__iexact`) matching is **rejected as the default** because (a) it diverges from the DB and manual entry, and (b) if two existing variants legitimately differ only by case (`abc` vs `ABC`), a case-insensitive lookup is ambiguous. Within-file duplicate detection must use the same exact-trimmed comparison so client and server agree.

**Documented edge case:** a manually created SKU with surrounding whitespace (e.g. `" ABC "`) is stored untrimmed and will not match a trimmed import value. This is a pre-existing manual-entry inconsistency; this plan does not change manual entry and treats such rows as non-matching (new) unless the user corrects the SKU. If the business wants case-insensitive or whitespace-insensitive SKUs, that is an explicit decision requiring a migration (see §12).

### 3.5 Verified UI building blocks for the modal (Revision UX)

The modal work must reuse existing conventions, not introduce new ones:

- **Primitives present** (`frontend/src/components/ui/`): `button`, `badge`, `input`, `select`, `radio-group`, `tooltip`, `popover`, `alert`, `dialog`, `modal`, `scroll-area`, `pagination`, `skeleton`, `tabs`, `collapsible`. `lucide-react` icons (`AlertCircle`, `CheckCircle2`, `Plus`, `Trash2`, `X`, `ChevronDown/Right`) are already used by the modal.
- **Current conflict styling** (`ImportReviewModal.tsx` ~line 361): the SKU `Input` already switches to `border-destructive` when a row has a `variant_sku` error, driven by a per-row `hasSkuError` predicate. This is the exact hook to extend for DB conflicts — it is already variant-level, not product-level.
- **Error surfaces today:** a top validation banner and a separate "Server returned errors" banner; `apiFetch` (`lib/api.ts`) also toasts `detail || message || error`.
- **No virtualization dependency:** `package.json` contains no `react-window` / `react-virtual` / `@tanstack/react-virtual`; large-file UX must reuse `ScrollArea` + `pagination` + the existing collapse-by-product rather than adding a dependency.

---

## 4. Bug-by-Bug Root Cause Analysis

### Bug 2 — Duplicate SKU does not identify the existing product

**Reported symptom:** when the import hits a duplicate SKU, the user is not told where the existing SKU is stored.

**Code evidence:**

| Evidence | File / symbol | Observation |
| -------- | ------------- | ----------- |
| E2.1 | `backend/apps/inventory/views/product_import_export.py` → `ProductImportParseView._build_preview` (line 283) | Builds preview rows from the file only. It calls `_resolve_brand_or_category` for brand/category but **never queries `ProductVariant` by SKU**. No existing-record metadata is returned. |
| E2.2 | `product_import_export.py` → `ProductImportConfirmView.post` (lines 321–411) | Groups rows by `product_name` (line 344), always `Product.objects.create(...)`, then `ProductVariant.objects.create(... sku=...)` (line 381). No pre-check against existing SKUs. |
| E2.3 | `product_import_export.py` lines 416–419 | The only collision handling is `except IntegrityError`, returning the raw DB string and `row_index: None`. No existing product/variant identity is resolved. |
| E2.4 | `frontend/src/components/inventory/product/ImportReviewModal.tsx` → `validateRows` (line 37), `seenSkus` (line 39) | Duplicate detection is **within-file only**, using a case-sensitive `Set<string>` of `variant_sku`. It never checks the database. |
| E2.5 | `ImportReviewModal.tsx` line 53 | Message is `Duplicate SKU: <sku>` — no existing product context is possible because none was fetched. |
| E2.6 | `frontend/src/hooks/useProductExportImport.ts` → `ImportRow` interface | The row type has `category_id/category_name/category_is_new` and `brand_*` for *new* values, but no `existing_*` fields. |
| E2.7 | `variant.py` line 19 | Duplicate is a `ProductVariant` row (`unique_together company_id, branch_id, sku`), so "where stored" = the variant's parent product/category/brand plus its `StockItem` warehouse(s). |

**Confirmed root cause:** there is no database duplicate lookup anywhere in the import pipeline, and the only signal is an exception that is stringified without resolving the target record. The information needed to answer "where is this SKU stored" is available in the model graph (variant → product → category/brand → stock_items → warehouse) but is never queried.

**Likely cause requiring verification:** none material; all of the above is directly observable in the source.

**Unknowns / reproduction:** how duplicate SKUs are presented in practice (per-row vs whole-import failure) can be confirmed by running confirm with two rows sharing an existing SKU — expected result is a single 422 with the raw DB message and nothing created.

**Additional finding (must be documented, not necessarily fixed here):** because `unique_together` ignores `is_deleted`, a SKU belonging to a **soft-deleted** variant still blocks a new insert, yet soft-deleted variants are invisible to normal product listings. A naive `is_deleted=False` duplicate lookup would report "no duplicate" and then fail at the DB layer. The duplicate lookup must therefore distinguish *active* duplicates (shown to the user) from *soft-deleted* duplicates (reported as an explicit conflict requiring a different SKU).

### Bug 3 — Missing product import conflict-resolution options

**Reported symptom:** no **Add New / Update Existing / Skip Duplicates / Replace Existing** options exist.

**Code evidence:**

| Evidence | File / symbol | Observation |
| -------- | ------------- | ----------- |
| E3.1 | `product_import_export.py` `ProductImportConfirmView.post` (line 321) | Only accepts `rows` + `source`. No conflict-policy input. |
| E3.2 | `product_import_export.py` line 344 | `groups.setdefault(pname, []).append(row)` — grouping is by product name, so two rows with the same product name and different SKUs become variants of one new product; there is no notion of "match an existing product". |
| E3.3 | `product_import_export.py` lines 352–411 | A new `Product` and new `ProductVariant`s are always created; no update path. |
| E3.4 | `product_import_export.py` lines 344–347 | If any row lacks `product_name`, all rows fail with 422 (`raise ImportValidationError(errors)`) before any write — all-or-nothing. |
| E3.5 | `ImportReviewModal.tsx` lines ~330–345 (footer) | Only "Cancel" and "Confirm & Create" exist. No policy selector. |
| E3.6 | `useProductExportImport.ts` → `useImportConfirm` | Sends only `{ rows, source }`. |
| E3.7 | `product_import_export.py` `_auto_sku` (line 180) | Missing SKUs get a random, time-based SKU and are never checked for collision. |

**Confirmed root cause:** the confirm contract and UI have no concept of a conflict policy. The workflow is single-behavior by construction.

**Semantics that must be decided before implementation:** see §6. The four policies do not all map to existing code paths; "Update Existing" and "Replace Existing" require new matching + mutation logic; "Skip Duplicates" requires partial-commit reporting (currently everything is one atomic transaction).

### Bug 4 — Technical database errors shown to users

**Reported symptom:** duplicate SKU errors display technical database errors.

**Code evidence:**

| Evidence | File / symbol | Observation |
| -------- | ------------- | ----------- |
| E4.1 | `product_import_export.py` lines 416–420 | `except IntegrityError as e: ... message: f'DB constraint: {e}. Nothing was created.'` and `errors: [{'row_index': None, 'error': str(e)}]` — raw database text is returned to the client. |
| E4.2 | `frontend/src/components/inventory/product/ImportReviewModal.tsx` lines 282–297 | Renders `serverErrors` verbatim as `Row {err.row_index + 1}: {err.error}`; with `row_index: null` this shows `Row 1` (null+1) and the raw DB message. |
| E4.3 | `frontend/src/lib/api.ts` (error extraction, ~lines 90–100) | Extracts `detail || message || error`. For the 422 body, `message` is chosen, so the toast also shows `DB constraint: ...`. |
| E4.4 | `backend/apps/common/exceptions.py` (`custom_exception_handler`) | Only wraps DRF `APIException`. A raw `IntegrityError` raised outside the import view's `try` would become an unhandled 500 (the import view does catch it, but `ProductViewSet.create/update` in `views/product.py` do **not** — the same SKU collision on manual create/update returns a 500/HTML error). |
| E4.5 | `backend/apps/inventory/views/product.py` `create` (~line 337) / `update` (~line 455) | No duplicate pre-check; direct `ProductVariant.objects.create`/`save` inside `transaction.atomic()`. |
| E4.6 | `backend/apps/inventory/tests.py` `ProductVariantTest.test_unique_together` | Asserts an exception is raised but does not cover API-level friendly messaging. |

**Confirmed root cause:** the import confirm view stringifies the caught `IntegrityError` into the response, and there is no structural distinction between field/row validation errors and database-constraint errors. The generic DRF handler cannot help because a) the view already caught the exception, and b) `IntegrityError` is not an `APIException`.

**Likely cause requiring verification:** whether log capture records the technical detail server-side today (no explicit `logger.exception` in the import view — nothing is logged, only returned).

---

## 5. Proposed Functional Behavior

### 5.1 Duplicate-location information (Bug 2)

When a row's `variant_sku` matches an existing variant in the importing user's `company_id` + `branch_id` scope, the parse response and the review UI should expose:

- `conflict_type: 'db_conflict' | 'file_duplicate' | 'soft_deleted' | null` — distinguishes an existing-database conflict from a within-file duplicate (required so the modal can show different messages)
- `existing_match: 'active' | 'soft_deleted' | null`
- `existing_product_id` (UUID `_id`), `existing_product_name`
- `existing_variant_id` (UUID `_id`), `existing_variant_title`
- `existing_category_name`, `existing_brand_name`, `existing_product_status`
- `existing_location`: list of `{ warehouse_name, quantity_on_hand, quantity_reserved }` from the variant's `StockItem`s
- `existing_sku` (the normalized SKU as stored)
- `duplicate_of_row_index`: the other imported row with the same SKU (for `file_duplicate`)

Every field above is an existing model field (`Product`, `ProductVariant`, `Category`, `Brand`, `StockItem`) or a derived identifier — **no invented fields**. Only records in the importer's `company_id` + `branch_id` are included.

Rules:
- Scope strictly to `company_id = request.user.company_id` and `branch_id = request.user.branch_id` (same scope as the DB constraint). No other company/branch data may be returned.
- Exclude `is_deleted=True` matches from the *active* match but still report a `soft_deleted` conflict (see §5.5) so the user knows why the SKU is blocked.
- If the user is not authorized for the target branch it can never be in scope (branch is fixed to the user's own branch), so no additional permission branching is needed.

### 5.2 Add New

**Intent:** preserve today's successful-import behavior for non-conflicting rows and never create a duplicate SKU silently.

**Matching / conflict definition:** a row conflicts when its trimmed SKU (case-sensitive, §3.4) already exists among active **or** soft-deleted variants in the importer's company+branch, **or** duplicates another row's SKU within the file. Rows with an empty SKU are not conflicts; they receive a generated unique SKU.

**Behavior:**
- Non-conflicting rows are created exactly as today: `Product` + `ProductVariant`(s) + `StockItem(0)` in the default warehouse; brands/categories auto-create; `source` recorded.
- Conflicting rows are **not written**. They are returned as structured row errors with `row_index`, `sku`, reason (`existing_sku` / `duplicate_in_file` / `soft_deleted_sku`), and the existing-product metadata from §5.1.
- Blank SKUs use `_auto_sku` with a bounded uniqueness retry loop (regenerate until free within company+branch) instead of the current unchecked single attempt (`_auto_sku`, line 180).

**Duplicate handling / transaction:** all-or-nothing — if any row conflicts, nothing is created and the response is a 422 listing the conflicting rows (preserves the current "Nothing was created" guarantee). This is the default policy when the client omits `conflict_policy`.

### 5.3 Update Existing

**Matching.** Primary key = the row's `variant_sku`, compared **exact + trimmed, case-sensitive** (§3.4), scoped to the importer's `company_id` + `branch_id`, against **active** variants (`is_deleted=False`). Rows with an empty SKU cannot match and are treated as new rows (generated unique SKU) — product-name matching is **not** enabled by default because `product_name` is not unique (see §12, Q1). A row whose SKU matches only a **soft-deleted** variant is reported as a conflict and cannot be updated; the user must supply a different SKU.

**Grouping (multiple rows → one product).** Rows are grouped by `product_name` as today (`groups.setdefault(pname, ...)`). Within a group:
- Every matched variant in the group must resolve to the **same** existing product. If matched variants resolve to two different products, the group is rejected with a 422 row-scoped error (ambiguous match).
- If ≥1 row matches, all unmatched rows in the group are created as **new variants of that matched product** (not new products).
- If no row matches, the group is created as a new product (same as Add New).

**Fields updated (variant-level):** `variant_title`, `barcode`, `buying_price`, `selling_price`, `min_stock_level`, `max_stock_level`. The `sku` itself is the match key and is **not** rewritten.

**Fields updated (product-level), once per group:** `description`, `unit`, `storage_requirement`, `tax_rate`, `category`, `brand`. `product_name` is **preserved** (not renamed) by default because the import groups by the imported name and renaming an existing product is a separate business action (see §12, Q3). `status` and `is_active` are **not** import-supported and are preserved (the import has no status column).

**Omit-on-empty:** an empty cell in an otherwise-present column preserves the existing value for Update (the imported row is not authoritative for blanks). A "missing column" cannot reach this path — the parser rejects files missing any `EXPECTED_COLUMNS` with a 400 before parsing completes (`_parse`).

**Inventory impact (revised 2026-10-10):** the review modal's **Qty** column is **added** to `StockItem.quantity_on_hand` in the default warehouse — the same warehouse the create path uses (`_get_default_warehouse`): 80 on hand + Qty 20 → 100. A blank Qty cell leaves stock untouched, and `quantity_reserved` is never modified. Each write locks the stock row (`select_for_update`), bumps `version`, and appends an `InventoryTransaction` (`ADD_STOCK`, `source_document_type='PRODUCT_IMPORT'`) so the inventory audit trail stays complete.

**Preserved:** product/variant `id` + `_id`, `created_at`/`created_by`, all `StockItem` rows, `VariantImage`s, `VariantAttribute`s, stock reservations, and every historical FK (see §5.5).

**Duplicate handling:** an existing-DB duplicate SKU means the row matches by definition; a within-file duplicate SKU is rejected during parsing/validation, so two rows cannot update the same variant twice.

**Transaction behavior:** the whole import runs in one `transaction.atomic()`; any unexpected error rolls back the entire import (all-or-nothing). See §6.1.

### 5.4 Skip Duplicates

**Intent:** import everything that is safe and leave every conflicting row untouched.

**Matching:** same conflict definition as §5.2 (existing active/soft-deleted SKU or within-file duplicate), exact + trimmed, case-sensitive, company+branch scoped.

**Behavior:**
- Conflicting rows are **not written** — no product, variant, stock, or stock movement is created or modified for them.
- All non-conflicting rows are imported normally (created), using the Add New creation path.
- Per-row reporting: each skipped row returns `row_index`, `sku`, `reason`, and existing-product metadata.
- In the modal each skipped row is dimmed and labelled **Skipped** but stays fully editable (`opacity-55 hover:opacity-100 focus-within:opacity-100`): correcting the SKU, switching policy, or fixing another field is never blocked by the skip state.

**Partial import (the only policy that commits a subset):** valid rows are committed; skipped rows are excluded. Because expected conflicts are detected before writes, the partial behavior does not depend on catching an exception — the skipped rows are simply not written. A per-row savepoint is still used as a safety net for an unexpected concurrent conflict (§6.1).

**Counters:** the response accurately reports `products_created`, `variants_created`, `rows_skipped` (and `rows_failed` for unexpected per-row DB failures). Existing keys `products_created`/`variants_created` are retained.

**Transaction:** outer `atomic()` plus a nested savepoint per row so one unexpected failure does not abort already-committed valid rows.

### 5.5 Replace Existing

**Definition (non-destructive, in-place update).** "Replace" overwrites the matched variant and its product with the values supplied by the import row, **in place**, keeping the same database rows, IDs, and relationships (stock changes only when a Qty is supplied — see below). It is explicitly **not** delete-and-recreate.

**Evidence that delete-and-recreate is unsafe (verified).** `ProductVariant` is referenced by `on_delete=models.PROTECT` from `InventoryTransaction` (`models/transaction.py:20`), `StockTransfer` (`models/transfer.py:14`), `PurchaseOrderLine` (`models/purchase.py:87`), `SalesOrderLine` (`models/sales.py:75`), `ReturnRefundLine` (`models/return_refund.py:99`), `CustomerInvoiceLine` / `CustomerInvoiceLineLink` (`finance/models/customer_invoice.py:93,169`), and `QuoteLine` (`sales/models/quote.py:68`). Deleting a referenced variant raises `ProtectedError`. `StockItem`, `VariantImage`, `VariantAttribute`, and `StockReservation` use `CASCADE`, so a delete would silently destroy stock/images/attributes. Replace must therefore update in place.

**Matching:** identical to Update Existing (§5.3) — exact + trimmed, case-sensitive SKU, active variants, same company+branch; soft-deleted match → conflict; grouping and multiple-row rules identical.

**Fields overwritten (variant-level):** `variant_title`, `barcode`, `buying_price`, `selling_price`, `min_stock_level`, `max_stock_level`.
**Fields overwritten (product-level):** `product_name`, `description`, `unit`, `storage_requirement`, `tax_rate`, `category`, `brand`.
**Not import-supported / preserved:** `sku` (match key), `qr_code`, `status`, `is_active`.
**Quantity (revised 2026-10-10):** Replace is authoritative for stock too — a supplied **Qty** *replaces* `StockItem.quantity_on_hand` in the default warehouse (80 on hand + Qty 20 → 20). A blank Qty cell leaves the stored quantity untouched. The write locks the row (`select_for_update`), bumps `version`, and appends an `InventoryTransaction` (`ADJUSTMENT`, `source_document_type='PRODUCT_IMPORT'`).
**Empty cells vs missing columns.**
- Missing column → 400 before any write (the parser requires all `EXPECTED_COLUMNS`); a malformed file cannot be partially processed.
- Empty cell in a present column → **Replace clears/overwrites it with the field default**, because Replace is authoritative: `description→''`, `unit→'PIECE'`, `storage_requirement→'AMBIENT'`, `tax_rate→0`, `category→null`, `brand→null`, `variant_title→''`, `barcode→''`, `buying_price→0`, `selling_price→0`, `min_stock_level→0`, `max_stock_level→0`. `product_name` is required and cannot be cleared (validated).
- Required/nullable validation: `product_name` required (existing rule); `category`/`brand` nullable; numeric fields validated `>= 0` (existing UI rule; see §12, Q2 for the clear-vs-preserve decision).

**Product-level when a variant matches but the imported name differs:** the matched variant's existing product is updated; under Replace `product_name` is set to the imported value (authoritative), while under Update it is preserved (see §12, Q3).

**Multiple variants of one product:** same grouping rules as §5.3; matched variants must resolve to one product, and unmatched rows are created as new variants of that product.

**Inventory impact (revised 2026-10-10):** stock changes only through the Qty cell (see above) — a blank Qty leaves balances and reservations untouched, and no stock row is ever deleted or recreated.

**Preserved:** IDs, `created_at`/`created_by`, stock rows, images, attributes, reservations, and all historical FKs.

**Transaction behavior:** single outer `transaction.atomic()`, all-or-nothing (§6.1).

### 5.6 User-friendly validation and DB-conflict messages

- Expected SKU conflicts are detected **before writes** wherever practical (in parse preview and again in confirm).
- Database uniqueness violations remain as a **final safety net**, caught via savepoints (per row for Skip Duplicates; the whole import for the all-or-nothing policies), and translated to: `Row N: SKU "<sku>" already exists for product "<name>" (category <cat>, brand <brand>, warehouse <wh>).` with `existing_*` metadata.
- Duplicate kinds are worded distinctly: database conflict → **`SKU already exists`** plus the existing product/variant details; within-file duplicate → **`Duplicate SKU in the uploaded file (also row N)`**. Soft-deleted match → **`SKU belongs to a deleted product; choose a different SKU`**.
- Never return SQL text, constraint names, stack traces, credentials, or other-tenant data.
- Field-level validation errors (e.g. negative prices) are preserved as structured `{ row_index, field, code, message }`.
- Technical details are logged server-side with `logger.exception`/`logger.warning` including a correlation id, at minimum the row index and company/branch.

### 5.7 Policy scope (global vs per-row)

- **Recommended (smallest coherent change):** one **import-level policy** chosen in the review modal, submitted with confirm, validated and enforced server-side. The server remains authoritative; the client selection is a request, not a guarantee.
- The selector must be **visible in the modal footer with a one-line summary of its effect** (e.g. "Add New: conflicting rows are recorded as errors and nothing is written"; "Skip Duplicates: non-conflicting rows import, conflicting rows are skipped") so the user understands the outcome before confirming.
- Per-row override is explicitly **out of scope** for this change (documented as a possible follow-up) to keep the UX and API minimal.

### 5.8 Review & Edit modal — workflow and visual-state specification (Revision UX)

**Workflow (verified against current code):**

1. User clicks **Import** on the Products page (`frontend/src/app/(app)/inventory/products/page.tsx`, `handleImportOpen`).
2. `ImportUploadModal` accepts `.xlsx/.xls/.csv`, validates type/size client-side, and POSTs to `/api/inventory/products/import/parse/`.
3. The backend parses, validates columns/rows, and (new, Bug 2) resolves each SKU against the DB **and** within the file.
4. The parse response returns enriched rows.
5. `handleImportParsed` stores the rows; **`ImportReviewModal` opens automatically** (`open={importRows.length > 0}`, line 381). No change to this mechanism.
6. The modal shows every imported product group and its variant rows, including the exact conflicting variants.
7. Conflicting variants get a red border **and** an icon + text (never color alone).
8. The user inspects existing-record details, edits values, selects a conflict policy, and reviews counts before confirming.
9. Confirm posts to `/api/inventory/products/import/confirm/`, which **revalidates server-side** before writing.

**Reuse rule:** extend `ImportReviewModal.tsx` and `ImportUploadModal.tsx`; do not add a second modal or workflow.

**Modal structure (maps to existing markup):**

- **Header** (exists): "Review & Edit" + close. Extend the subtitle to `N row(s) · N variant(s) · X valid · Y conflicting · Z invalid`.
- **Body** (exists: product groups + editable table). Add a per-row validation cell/indicator, the red border on the exact conflicting SKU input, an inline message, and an existing-record disclosure; distinguish DB conflicts from within-file duplicates. Add the editable **Qty** column (per-policy effect in the header tooltip and footer summary; the cell shows the resulting balance, e.g. `80 + 20 = 100` for Update and `80 → 20` for Replace).
- **Footer** (exists: Cancel / Confirm & Create). Add the policy selector + effect summary, a **Revalidate** button, and rename the primary action to **Confirm Import** with disabled/loading states.

**Per-variant highlight rule:** the red border applies to the **SKU `Input` of a conflicting row only**. The current per-row predicate (`hasSkuError`, `ImportReviewModal.tsx` ~line 361) is the hook to extend to `conflict_type==='db_conflict' | 'soft_deleted'` keyed by `row_index`. Sibling variants and the product header are never marked.

**Visual-state specification:**

| State | Trigger | Indicator | Message | Blocking? |
| ----- | ------- | --------- | ------- | --------- |
| Valid | no error for the row | default border | — | No |
| DB SKU conflict | `conflict_type==='db_conflict'` | `border-destructive` + `AlertCircle` | "SKU already exists — used by <product> / <variant>" + existing details | Add New: yes; Update/Replace: it is the match target; Skip: handled |
| Skipped row | `policy==='skip_duplicates'` and the row conflicts | row dimmed (`opacity-55`, full opacity on hover/focus) + **Skipped** badge | "SKU already exists — this row will be skipped" | No — the row stays editable so the SKU can be fixed or the policy switched |
| Within-file duplicate | two rows share the SKU | `border-destructive` + `AlertCircle` | "Duplicate SKU in the uploaded file (also row N)" | Yes, under every policy, until fixed |
| Soft-deleted SKU | matches a deleted variant | `border-warning` + `AlertCircle` | "SKU belongs to a deleted product; choose a different SKU" | Yes |
| Missing SKU | empty SKU | `border-warning` + `AlertCircle` | "No SKU — one will be generated" | No (warning) |
| Other row error | e.g. negative price | `border-destructive` + `AlertCircle` | field message | Yes |
| Corrected / revalidated | revalidation passed | default border + transient `CheckCircle2` | "Valid" | No |

**Blocking vs warning:** blocking errors disable **Confirm Import** (as `hasErrors` does today); warnings (e.g. generated SKU) do not. The footer summary must state which rows will be created/updated/skipped under the selected policy.

**Existing-record panel:** for a conflicting row, render the §5.1 fields (existing product name, variant title, SKU, category, brand, warehouse/location, active vs deleted) in an inline disclosure (`Popover`/`Tooltip`/expandable row) using existing primitives. Show only fields that exist on the models and belong to the user's company+branch.

**Locate the row:** clicking a header count scrolls/focuses the offending SKU input; collapsed groups containing a conflict auto-expand.

### 5.9 Editing & revalidation

- **Within-file duplicates** recompute instantly in the client on every SKU change (pure function over `rows`, same exact-trimmed comparison as the server). No DB call.
- **Database conflicts** revalidate on the server via a new additive endpoint `POST /api/inventory/products/import/validate/` accepting `{ rows, conflict_policy? }` and returning per-`row_index` validation + `existing_*` metadata, reusing the same resolution helper as parse/confirm.
- **Trigger:** debounce SKU edits (~400–500 ms) and batch changed rows into one request; also expose an explicit **Revalidate** button. **Never issue a DB request per keystroke.**
- **Per-row SKU state machine:** `clean → dirty (pending) → valid | conflict | soft_deleted | file_duplicate`. The red border clears **only** after the server confirms validity.
- **Concurrent-edit safety:** the validate/confirm response carries only validation metadata keyed by `row_index`; it must **never overwrite the user's edited field values**.
- **Loading/error/retry:** inline spinner while validating; on request failure keep the last known state, show a non-blocking "Couldn't revalidate — Retry", and never silently mark a row valid.
- **Confirm is authoritative:** regardless of the modal's last state, confirm re-resolves duplicates and re-checks permissions inside its transaction.

### 5.10 Accessibility and large files

- **Not color alone:** every red border is paired with an `AlertCircle` icon and text; add `aria-invalid` and `aria-describedby` to the SKU input and `role="alert"` to the inline message.
- **Keyboard:** conflicting rows are tab-reachable; "locate" moves focus to the SKU input; the policy selector uses the existing `radio-group`/`select` primitives for keyboard support.
- **Large files:** no virtualization dependency exists; reuse collapse-by-product + `scroll-area` and paginate product groups with the existing `components/ui/pagination.tsx` (e.g. 25 groups/page). No new dependency.

---

## 6. Detailed Implementation Plan

**Implementation order (Revision A):** **Bug 2 → Bug 4 → Bug 3 → tests/docs.** Reliable duplicate detection and existing-product information (Bug 2) must exist before conflict policies (Bug 3) can be specified or enforced, and the import-specific friendly error handling (Bug 4) is the foundation the policies' failure reporting relies on.

### 6.1 Transaction and error-handling model (Revision D)

Verified current behavior:

- `ProductImportConfirmView.post` wraps the whole import in a single `with transaction.atomic():` and catches `ImportValidationError` and `IntegrityError` **outside** the atomic block.
- In Django, a database error raised inside an `atomic()` block marks the surrounding transaction as needing rollback; **no further queries can run in that block until it is rolled back.** Catching `IntegrityError` outside the block therefore rolls back the entire import — today's all-or-nothing behavior.
- To continue after a per-row database error, each row/unit must run inside a **nested `transaction.atomic()` (savepoint)**. On error the savepoint rolls back and the outer transaction stays usable.

Recommended model:

| Scenario | Transaction model | Result |
| -------- | ----------------- | ------ |
| Validation failure (missing product name, bad numbers, unknown policy, missing columns) | Pre-write validation; nothing written | 400/422 with `errors[]`, no writes |
| All-or-nothing policies (Add New, Update Existing, Replace Existing) | One outer `atomic()` | Any error rolls back the whole import; counters reflect zero writes |
| Skip Duplicates | Outer `atomic()` + nested savepoint per row | Valid rows commit; skipped rows excluded; an unexpected per-row failure rolls back only that savepoint and is reported in `rows_failed` |
| Unexpected DB failure | Savepoint rollback + `logger.exception`; whole-import rollback for non-skip policies | Friendly 422/409; no orphaned products/variants/stock; no misleading counters |
| Concurrent SKU conflict created after preview | Confirm re-runs duplicate detection inside the transaction; savepoint catches the race | Friendly, row-scoped conflict; consistent state |

This model prevents orphaned `Product`s, partially created variants, incorrect `StockItem` rows, and inflated counters, because counters are only incremented after the corresponding unit's savepoint succeeds.

**Policy scope:** one **import-level** policy per confirmation (§5.7). No per-row override in the initial design; the server validates and enforces the policy and the client selection is advisory only.

### Phase 1 — Bug 2: duplicate detection and existing-product information

Shared helpers (no behavior change on their own):

1. **`backend/apps/inventory/views/product_import_export.py`** — add `_find_existing_variants(skus, company_id, branch_id)` returning a dict keyed by the **exact trimmed SKU** (case-sensitive, §3.4) with the matched variant + product/category/brand context, plus a second pass for soft-deleted matches (`is_deleted=True`). Resolve in **one batched query** (`sku__in=[...]`) for large imports. `_existing_location(variant)` returns `StockItem` warehouse rows.
2. Add `_build_duplicate_metadata(row, existing_variant)` producing the `existing_*` fields in §5.1, and a within-file duplicate annotator using the same exact-trimmed comparison.
3. Add the module-level `CONFLICT_POLICIES = {'add_new','update_existing','skip_duplicates','replace_existing'}` constant.

Deliverables:

4. **Parse view** (`ProductImportParseView._build_preview`, line 283): after building rows, resolve existing (active + soft-deleted) and within-file duplicates in batch and attach `existing_*`, `is_duplicate_in_file`, `duplicate_of_row_index`.
5. **`ImportRow` type** (`frontend/src/hooks/useProductExportImport.ts`): extend with the optional `existing_*` and `is_duplicate_in_file` fields.
6. **Review modal** (`ImportReviewModal.tsx`): show an "Exists" indicator per row (product name, category, brand, warehouse/location, active vs deleted) and a conflict banner. Keep the client `validateRows` but make its comparison match the server exactly (exact + trimmed, case-sensitive).
7. **Confirm view**: re-resolve duplicates server-side before any write, ignoring client-supplied metadata.

### Phase 2 — Bug 4: friendly import errors

8. **Confirm view**: replace `f'DB constraint: {e}. Nothing was created.'` (lines 416–420) with a translated, row-scoped, human message; never include `str(e)`.
9. Use savepoints per §6.1 so an `IntegrityError` can be caught without aborting the batch where the policy permits, and the affected `row_index` + `sku` are known.
10. **Response shape**: keep the existing `{ status, message, errors: [{ row_index, field?, code, message, existing? }] }` envelope (the frontend `apiFetch` reads `detail || message || error`, and the modal renders `errors`), so this is backward-compatible. `row_index` must never be `null` in a rendered entry — always resolve the affected row.
11. **Logging**: add `logger = logging.getLogger(__name__)`; `logger.warning` for expected conflicts, `logger.exception` for unexpected `IntegrityError`, both including row index, SKU, `company_id`, `branch_id`. Nothing technical is returned to the client.
12. **Frontend** (`ImportReviewModal.tsx`): render structured `errors` defensively (guard a missing `row_index`), show the friendly message, and optionally reference the existing product.

**Do not expand this phase** to manual create/update endpoints or a global exception-handler redesign (see §6.2).

### Phase 3 — Bug 3: conflict-resolution policies

13. **Confirm API contract**: accept `conflict_policy` (default `add_new`) and validate against `CONFLICT_POLICIES`; an unknown value returns a friendly 400. The server is authoritative.
14. Implement per-policy execution in `ProductImportConfirmView.post` exactly as specified in §5.2–§5.5:
    - `add_new` — uniqueness pre-check + collision-safe auto-SKU; conflicting rows become row errors; all-or-nothing.
    - `update_existing` — exact-trimmed SKU match (§5.3); omit-on-empty; preserve stock/IDs/relations.
    - `skip_duplicates` — skip conflicting rows, import the rest, report skipped rows.
    - `replace_existing` — exact-trimmed SKU match; overwrite supported fields per §5.5; preserve stock/IDs/relations.
15. **Frontend review modal**: add a policy selector (radio/segmented control) in the footer, defaulting to "Add New"; pass it to `useImportConfirm`.
16. **`useProductExportImport.ts`**: extend `useImportConfirm` args with `conflict_policy`, and `ImportConfirmResponse.data` with `products_updated`, `variants_updated`, `rows_skipped`, `rows_failed`; keep `products_created`/`variants_created` for backward compatibility.
17. Update the success screen to report created/updated/skipped counts and list skipped rows.

### Phase 4 — Tests, docs, changelog

18. Add backend tests (§8). Document manual frontend QA (no frontend test framework is introduced).
19. Update `docs/bugfoundresolved.md` and `CHANGELOG.md`; update `docs/workflow.md` §7.6 / `agent.md` if the API shape changes.
20. Do **not** alter migrations, unique constraints, or dependencies.

### 6.2 Scope control (Revision E)

In scope: Bug 2/3/4 backend + frontend import changes, tests, and the two documentation files. Reuse existing patterns (`CompanyBranchMixin`, `PermissionRequiredMixin`, the `{ status, message, data }` envelope, Django `TestCase`/`APIClient`, React Query hooks).

Explicitly **not** included without separate approval:

| Adjacent issue | Verified evidence | Risk | Why not now | Smaller alternative |
| -------------- | ----------------- | ---- | ----------- | ------------------- |
| Global `custom_exception_handler` change to map `IntegrityError`/`DatabaseError` | `apps/common/exceptions.py` only wraps DRF `APIException` | Medium — affects every endpoint | Bug 4 is about **import** errors; the import view already catches `IntegrityError` | Handle the exception inside `ProductImportConfirmView` only |
| Manual `ProductViewSet.create/update` friendly duplicate errors | `views/product.py` create (~337) / update (~455) have no duplicate pre-check and no `IntegrityError` handling (a SKU clash can 500) | Medium | Separate endpoint, outside the reported import bug | A small shared `sku_conflict_message()` helper can be reused later, but change manual endpoints only under a separate task |
| Database uniqueness normalization (`CITEXT` / `Lower('sku')`) | `unique_together` is plain and case-sensitive (§3.4) | High — migration + data rewrite | Out of scope; no evidence the business wants case-insensitive SKUs | Exact-trimmed matching; reassess if the business rule changes |
| New frontend test framework | `frontend/**/*.test.*` → 0 matches | Low | Adds dependencies | Document manual QA |

### 6.3 Review & Edit modal workstream (Revision UX)

Backend:

- **New** `ProductImportValidateView` in `backend/apps/inventory/views/product_import_export.py` (+ route `products/import/validate/` in `backend/apps/inventory/urls.py`). Same `CompanyBranchMixin` + `PermissionRequiredMixin`; reuses the §6.1/Phase-1 duplicate-resolution helper and the batched `sku__in` lookup.
- Extend `_build_preview` / the parse response with `existing_*`, `conflict_type`, `duplicate_of_row_index` (§5.1).
- Confirm revalidation + friendly messages as in §6.1 and the Phase 2 items.

Frontend:

- `frontend/src/hooks/useProductExportImport.ts`: extend `ImportRow` with `existing_*`, `conflict_type`, `duplicate_of_row_index`; add `useImportValidate` (debounced batch validate); extend `useImportConfirm` with `conflict_policy`.
- `frontend/src/components/inventory/product/ImportReviewModal.tsx`: header counts; per-row validation cell and red border (icon + text); existing-record disclosure; DB-vs-file duplicate distinction; policy selector + effect summary; Revalidate button; group pagination; accessibility attributes; accurate success/skip reporting.
- `frontend/src/app/(app)/inventory/products/page.tsx`: **no structural change expected** (the modal already auto-opens; prop passing unchanged).
- `frontend/src/components/inventory/product/ImportUploadModal.tsx`: no change expected.

Reuse: `Button`, `Badge`, `Input`, `RadioGroup`, `Tooltip`/`Popover`, `ScrollArea`, `pagination.tsx`, `lucide-react` icons, and `sonner` (via `apiFetch`). **No new dependency.**

### Permissions and tenant isolation

- Reuse `CompanyBranchMixin` + `PermissionRequiredMixin` (unchanged). New lookups must pass `company_id`/`branch_id` explicitly and filter `is_deleted` deliberately.
- No new permission codes are required; import continues to require `INVENTORY:product:create` (per the existing view) and the UI gating already checks `permissions.create`.

---

## 7. Acceptance Criteria

### Bug 2
- [ ] Parse response includes existing-record metadata for every row whose SKU already exists in the user's company+branch.
- [ ] The review modal visibly shows the existing product name, category, brand, and warehouse/location for duplicate rows.
- [ ] Duplicates are detected against the database and within the uploaded file using the same **exact, trimmed, case-sensitive** comparison as the database constraint (§3.4).
- [ ] Differently-cased or whitespace-padded SKUs are treated consistently with the DB (distinct), and the server and client comparisons agree.
- [ ] A soft-deleted SKU is reported distinctly and explains why a new insert is blocked.
- [ ] No data from another company or branch is returned (verified by test).
- [ ] Confirm re-validates duplicates server-side even if the client omits metadata.

### Bug 3
- [ ] The review modal exposes Add New, Update Existing, Skip Duplicates, Replace Existing.
- [ ] The chosen policy is submitted with confirm, validated server-side, and rejects unknown/absent-but-required values with a friendly 400.
- [ ] Add New never silently creates a duplicate SKU.
- [ ] Update Existing modifies only import-supported fields by matching rule and preserves stock/IDs/relations.
- [ ] Skip Duplicates imports non-conflicting rows and reports each skipped row with a reason.
- [ ] Replace Existing overwrites fields on the matched row without deleting/recreating or touching stock.
- [ ] Counters are accurate per policy: created vs updated vs skipped vs failed, with no inflated or zero-on-failure numbers.
- [ ] Add New / Update Existing / Replace Existing are all-or-nothing; Skip Duplicates commits only valid rows.
- [ ] Behavior is defined and tested for: DB duplicates, within-file duplicates, multiple rows targeting one existing product, invalid/incomplete rows, missing/generated SKUs, concurrent conflicts after preview, partial failure, and existing stock balances.

### Bug 4
- [ ] Duplicate-SKU responses contain friendly, row-scoped messages with the affected row and SKU.
- [ ] No raw SQL, constraint names, stack traces, or other-tenant data appear in any error response (verified by test).
- [ ] Field-level validation errors remain structured and actionable.
- [ ] Expected conflicts are detected before writes where practical; DB constraints remain as the final safety net and are **not** weakened.
- [ ] Technical detail is logged server-side with correlation context (row index, SKU, company, branch).
- [ ] No orphaned products/variants/stock and no misleading success counters result from a failed import.

### Review & Edit UX (measurable)
- [ ] No-conflict file → modal opens automatically; all rows valid; Confirm Import enabled.
- [ ] One existing-SKU conflict → only that variant shows a red border + `AlertCircle` + `SKU already exists`, with existing product/variant/category/brand/warehouse; sibling variants are not red.
- [ ] Multiple conflicts across different variants → each conflicting variant is flagged individually within its group.
- [ ] Two imported variants share a SKU → both rows are flagged as within-file duplicates referencing each other.
- [ ] Editing a conflicting SKU to a valid value → red border clears **only** after server revalidation passes.
- [ ] Editing a conflicting SKU to another existing SKU → the conflict info updates to the new existing record.
- [ ] Existing product details are shown only for records in the user's company+branch.
- [ ] Soft-deleted SKU → a distinct, non-color-only message; the row is blocked.
- [ ] Edited field values survive a validation request and a validation error (unsaved edits preserved).
- [ ] Revalidation is batched/debounced (no request per keystroke) and has loading/error/retry states.
- [ ] Policy selector is visible with an effect summary; Confirm Import reports accurate created/updated/skipped/failed counts.
- [ ] A concurrent conflict created after preview → confirm revalidates and reports a friendly error with no partial writes.
- [ ] Accessible: every red border has an accompanying icon + text; the SKU input exposes `aria-invalid`/`aria-describedby`.

---

## 8. Testing Strategy

**Backend (Django tests, following `backend/apps/inventory/tests.py` style):**
- Unit: `_find_existing_variants`, SKU matching (exact / trimmed / case-sensitive), `_existing_location`, auto-SKU collision retry, policy validation.
- API/integration (`APIClient`): parse returns `existing_*`; confirm for each policy; unknown policy → 400; duplicate → 422/409 with friendly message; no raw `duplicate key` text in the body.
- Tenant/branch isolation: create the same SKU in company 2 / branch 2 and assert the import for company 1 / branch 1 neither sees nor is blocked by it incorrectly (and vice-versa).
- Case & whitespace: `"ABC"` vs `"abc"` are treated as distinct (matching the DB); `" ABC "` is trimmed on import; an untrimmed legacy DB SKU does not match.
- Soft-delete: a soft-deleted SKU produces a distinct conflict, not a silent failure.
- Empty vs missing fields: a missing column is a 400 before any write; an empty cell preserves (Update) or clears-to-default (Replace) with the documented per-field defaults.
- Multiple rows → one product: matched variants resolving to two products produce a 422; unmatched rows become new variants of the matched product.
- Stock/variant preservation: Update Existing and Replace Existing leave `StockItem.quantity_on_hand`/`quantity_reserved` unchanged and do not delete variants/images/attributes or change IDs.
- Transaction: all-or-nothing policies roll back completely on failure; Skip Duplicates commits valid rows and reports `rows_skipped`/`rows_failed`.
- Concurrency/transaction: simulate a conflict created after preview; assert the response is friendly and the transaction state is consistent.
- Regression: normal create import still succeeds; generated SKUs are unique.
- Import error handling: `IntegrityError` inside `ProductImportConfirmView` is caught via a savepoint and returned as a friendly, row-scoped 422 (no global handler change).

**Frontend:**
- The repository has **no frontend test files** (`frontend/**/*.test.*` → 0 matches). No new framework is introduced. Documented **manual QA** for the Review & Edit modal:
  1. Upload a no-conflict `.xlsx` → modal opens automatically; header shows valid counts; Confirm Import enabled.
  2. Upload a file with one existing SKU → exactly that variant is red with an `AlertCircle` + `SKU already exists` and existing-record details; nothing else is red.
  3. Upload a file with multiple conflicts across variants → each is flagged in its own group; clicking the header count scrolls/focuses the offending input.
  4. Upload a file with two rows sharing a SKU → both flagged as within-file duplicates (message names the other row).
  5. Edit a conflicting SKU to a valid value → border clears only after revalidation; to another existing SKU → conflict info updates.
  6. Edit a non-SKU field, then trigger a validation error → the edit is preserved.
  7. Slow/failing `validate/` request → inline spinner, then a non-blocking Retry; no row is silently marked valid.
  8. Confirm shows created/updated/skipped/failed counts and lists skipped rows; server 422 renders a friendly message (never raw SQL).
  9. Keyboard-only: tab to a conflicting row, use the policy selector, and focus the SKU input; `aria-invalid`/`aria-describedby` present.
  10. Large file (many groups) → pagination + collapse keep the modal responsive.

**Test-execution note:** this planning task did not execute the suite. Per the task constraints, tests are to be run during implementation; existing `ProductVariantTest.test_unique_together` only asserts a raised exception and does not cover API messaging.

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Update/Replace accidentally resets stock or deletes relations | Data loss / inventory corruption | Explicitly exclude `StockItem`, images, attributes, IDs from the update path; tests assert preservation. |
| Delete-and-recreate assumed for "Replace" | `ProtectedError` or silent CASCADE data loss | Verified `PROTECT` references (§5.5); define Replace as in-place field overwrite; never delete products/variants. |
| SKU case/whitespace mismatch between import and manual entry | Duplicate-looking SKUs treated inconsistently | Import trims and matches exactly/case-sensitively (§3.4); documented legacy-untrimmed edge case. |
| `IntegrityError` caught without a savepoint | Whole batch aborts unexpectedly; transaction unusable afterwards | Per-row nested `atomic()` savepoints (§6.1). |
| Update/Replace touching relationships or stock | Broken history / corrupt inventory | Explicit preserved-field list; tests assert stock/IDs/relations unchanged. |
| Soft-deleted SKUs block inserts but are invisible | Confusing failures | Distinguish `active` vs `soft_deleted` conflicts; require a new SKU for deleted collisions. |
| Partial commits under Skip Duplicates | Half-imported data | Per-row savepoints + explicit result reporting; document all-or-nothing default for other policies. |
| Client-trusted duplicate data | Security/tenant leak | Server always re-resolves; scope strictly by company+branch; ignore client-supplied metadata. |
| Auto-SKU collision | IntegrityError | Bounded retry loop with uniqueness check. |
| API contract change | Frontend breakage | Additive fields only; keep existing counters; default `conflict_policy='add_new'`. |
| Duplicate lookups add queries on large files | Performance | Batch-resolve SKUs (`__in`) instead of per-row queries where possible. |

---

## 10. Implementation Order and Dependencies

Revised order (Revision A): **Bug 2 → Bug 4 → Bug 3 → tests/docs.**

1. **Bug 2 first (detection and existing-product information)** — shared detection helpers + batched lookup + parse enrichment + review UI. This establishes the single source of truth for "what is a duplicate" that everything else depends on. No writes change behavior yet.
2. **Bug 4 second (friendly import errors)** — the savepoint/transaction model (§6.1), IntegrityError translation, structured row errors, and logging. Depends on Bug 2's duplicate resolution to produce the friendly message. Scope-limited to the import view.
3. **Bug 3 third (conflict policies)** — confirm `conflict_policy` contract + per-policy execution + selector + counters. Depends on both Bug 2 (matching/metadata) and Bug 4 (error/reporting foundation).
4. **Tests/docs** — finalize with `bugfoundresolved.md`, `CHANGELOG.md`, and the new tests.

Why not Bug 4 first: detecting duplicates reliably (Bug 2) is a prerequisite for producing *meaningful* friendly messages; fixing only the error string would still leave the user without the existing-product context Bug 2 provides.

---

## 11. Out of Scope

The following seven bugs must **not** be investigated or fixed in this task:

- **Bug 1** — Deleted products/SKUs and trash/archive visibility.
- **Bug 5** — Stock-in-hand import and bulk opening-stock updates.
- **Bug 6** — Invoice customization/removal.
- **Bug 7** — Line-item tax not included in final invoice total.
- **Bug 8** — Incorrect invoice total/tax calculation.
- **Bug 9** — Purchase Orders page fails to load.
- **Bug 10** — Additional payment methods.

Related non-goals: no `makemigrations`/`migrate`, no schema/constraint changes, no SKU-uniqueness weakening, no unrelated refactors, no destructive Git operations, no changes to other bug reports.

---

## 12. Open Questions and Approval Checklist

### 12.1 Resolved from verified code (no approval needed)

| Item | Resolution | Evidence |
| ---- | ---------- | -------- |
| SKU comparison case-sensitivity | **Case-sensitive, exact, trimmed** matching | §3.4; `models/variant.py:19`; migrations |
| What counts as a conflict | Existing active SKU, existing **soft-deleted** SKU, or within-file duplicate SKU | `models/variant.py:19`; §5.2 |
| Response envelope | Keep `{ status, message, data }` and `{ status, message, errors }` | `product_import_export.py`; `lib/api.ts` (`detail \|\| message \|\| error`) |
| Transaction default | All-or-nothing for Add New / Update Existing / Replace Existing; partial for Skip Duplicates | §6.1 |
| Policy scope | One import-level policy per confirmation | §5.7 |
| Replace is non-destructive | Forced by `on_delete=PROTECT` references on `ProductVariant` | §5.5; `models/transaction.py:20`, `models/sales.py:75`, `models/purchase.py:87`, etc. |

### 12.2 Genuine business decisions requiring confirmation

| # | Question | Impact if wrong | Recommended default | Approval required? |
| - | -------- | --------------- | ------------------- | ------------------ |
| Q1 | Should Update/Replace support a **product-name fallback** when a row has no SKU? | A fallback could update the wrong product (`product_name` is not unique) | **No fallback** — SKU-only matching; SKU-less rows are created as new | Yes |
| Q2 | Replace with an **empty cell**: clear the field or preserve it? | Silent data loss if "clear" is unexpected | **Clear** (Replace is authoritative); Update preserves | Yes |
| Q3 | Under Update, should a differing imported `product_name` **rename** the matched product? | Unintended rename of a product with history | **No rename** under Update; Replace sets the imported name | Yes |
| Q4 | Is partial import acceptable for Skip Duplicates? | Users may expect all-or-nothing | **Partial** for Skip Duplicates only | Yes |
| Q5 | Should SKUs become **case-insensitive / whitespace-insensitive** as a business rule? | Requires a DB migration + dedup of existing rows | **No** — keep current DB semantics; revisit as a separate migration task | Yes |
| Q6 | Fix manual `ProductViewSet.create/update` duplicate 500s in this task? | Same class of bug on a different endpoint | **No** — separate follow-up task (§6.2); only prepare a shared helper | Yes |
| Q7 | Add the additive `POST /api/inventory/products/import/validate/` endpoint for server-side revalidation of edited rows? | Without it, revalidation of edits would be client-only (stale, non-authoritative) | **Yes** — additive route, no schema change | Yes |
| Q8 | Under Update/Replace, is an existing-SKU conflict **blocking**? | Wrong gating could block a valid update or allow a silent one | **Not blocking** for Update/Replace (it is the match target); blocking for Add New | Yes |

**Approval checklist:**
- [ ] Revised plan content accepted, or further revisions requested.
- [ ] Q1–Q8 (§12.2) confirmed.
- [ ] Explicit approval to begin implementation in the order **Bug 2 → Bug 4 → Bug 3**.

> ⚠️ **STOP.** Implementation has not started. I am waiting for your review and explicit approval before changing any application code.
