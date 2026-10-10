# Changelog

All notable changes to the **Al Qaiser Nexus ERP (Al-Qaiser BOS)** project.

---

## [1.6] — 2026-10-10

### Added
- **Trash grouped by module** — Deleted records are now organised into collapsible sections per module (Settings, Inventory, Finance, Sales, Human Resources) with per-section totals and an expired count, instead of one long flat list. Module chips across the top filter to a single module and show live totals.
- **Sort and date filters in Trash** — Sort by newest, oldest, expiring soonest, name (A–Z), or module & type. Filter by the date a record was deleted using a from/to range, alongside the existing search and "expired only" toggle.
- **`deleted_by: null` renders as "Unknown (legacy)"** — Legacy rows restored to the trash by the backfill below are labelled instead of showing a bare dash, with a tooltip explaining that no user is recorded.

### Fixed
- **Deleted products still listed on Inventory → Stock Management** — The stock endpoints build their own querysets with `StockItem.objects`, which bypasses `CompanyBranchMixin.get_queryset()` — the only place that applies `is_deleted=False`. Deleted products therefore kept appearing on the stock page, and their quantities were counted in the "Total Units On Hand" and "Low Stock Items" cards. All stock actions (`current_stock`, `retrieve`, `variant_summary`, `pos-catalog`, `batch-stock`, `adjust`) now scope to live rows through new `alive_stock()` / `alive_variant()` helpers that check the stock row **and** its variant and product, so a half-cascaded delete cannot leak either. Stock adjustment refuses deleted variants instead of resurrecting them, and the endpoint cache keys were version-bumped so a stale cached response cannot keep serving deleted rows.
- **Stock pagination could repeat or skip records** — `current_stock` paginated an unordered queryset, which lets the database return rows in a different order per page. It now orders by product name, SKU, and id.
- **Rows stored as deleted were stuck outside the Trash** — 60 rows (`inventory.Product` / `ProductVariant` / `StockItem`, imported as deleted before `deleted_at` existed) had `is_deleted=True` with no timestamp. The Trash hides rows without a timestamp and the retention purge skips them, so they were permanently stuck: still reserving unique constraints but impossible to review or clean up. A data migration in each of the 10 affected apps stamps `deleted_at = updated_at` (optionally via `backfill_deleted_at(app_label, dry_run=True)`). They now appear in the trash and age out normally. `deleted_by` is intentionally left NULL — no user performed those deletions.
- **Editing a variant attribute crashed with a duplicate-key error** — `VariantAttribute` is unique on `(variant, attribute_key)`, and the replace flow soft-deleted the old rows before inserting the same key, hitting the still-present unique index. Attribute writes now upsert: the existing row (soft-deleted or not) is revived and updated in place.
- **Bulk soft-deletes never recorded who deleted** — `queryset.update(is_deleted=True)` bypasses `Model.save()`, so eight more call sites (variant attributes/images, invoice lines, employee photos and documents, loan/compensation months, old forecasts) left `deleted_by` and `deleted_at` empty. All now go through a new `soft_delete_qs(queryset, user)` helper in `apps/common/basemodel.py`, which records the actor and the instant in one place.
- **"Permanently deleted 0 item(s)… 1 item(s) could not be deleted"** — The PROTECT pre-flight only checked the item itself, but a Product's *variants* are held by `InventoryTransaction`, `CustomerInvoiceLine`, and six other `PROTECT` relations. The check therefore passed, the delete started, and `ProtectedError` broke the surrounding transaction — after which every other item in the bulk action failed with the same opaque message. The blocker scan is now recursive across the whole cascade graph and runs **before** any transaction opens, so nothing is ever partially deleted. Bulk actions report `blocked` separately from real errors, and the message names the item and its references: *"…cannot be permanently deleted: it is still referenced by 2 Inventory Transaction, 1 Customer Invoice Line. Those records must be removed first."* The page shows a warning for such items, which can never age out while the references exist.

---

## [1.5] — 2026-10-10

### Added
- **Settings → Trash module** — One place to see everything deleted anywhere in the system. Lists deleted records grouped by type (users, departments, designations, categories, brands, warehouses, suppliers, customers, products, accounts, invoices, bills, expenses, budgets, bank accounts, journal entries, leads, quotes, employees, leave requests, policies, assets, shift templates, exit records) with who deleted it, when, and a live countdown to auto-deletion. Filter by type, search across records, page through results.
- **Permanent delete** — Delete any single trashed record forever, with a confirmation that first shows exactly which related records disappear with it (deleting a product also purges its variants and their stock rows). "Empty trash" and "Purge expired" bulk actions are included.
- **Restore** — Put a deleted record back into its module, gated by its own `SETTINGS:trash:restore` permission. Restoring a parent does not resurrect cascade-deleted children.
- **30-day automatic purge** — Anything in the trash longer than 30 days is permanently deleted by the daily Celery beat task (`compsetting.purge_expired_trash`, 04:00). The window is configurable via `TRASH_RETENTION_DAYS`.
- **`deleted_at` on every soft-delete model** — New field on `BaseModel` (plus `organization.User`) recording when a row was soft-deleted, maintained automatically by `save()`. This is the clock the retention policy uses.
- **`SETTINGS:trash` permissions** — `view`, `delete`, `restore` seeded for `COMPANY_ADMIN`, with per-module fallbacks so an Inventory or Finance admin can manage their own module's trash.

### Changed
- **Soft-delete now records a timestamp** — Roughly twenty views already assigned `instance.deleted_at = timezone.now()` before saving (HR employee/asset/policy/leave/payroll/exit, notifications); those assignments were silently discarded because the field did not exist. They now persist for real.
- **`compsetting.TimeStampedModel`** — `deleted_at` moved up to `BaseModel` as the single source of truth. The six existing `compsetting_*` columns are preserved: a state-only migration re-attaches the field instead of dropping it.

### Fixed
- **Deletion timestamps were never stored** — `deleted_at` existed only on the six `compsetting` tables; everywhere else the attribute was set in Python and thrown away, so nothing knew when a record had been deleted.
- **Trash API permission action was wrong** — `PermissionRequiredMixin` resolves plain `APIView`s through the HTTP-method fallback, so restore (POST) was checked as `create`. Explicit per-view `required_action` fixes it.
- **Cascade preview looked at the wrong relations** — The dependency scan walked forward foreign keys (including the audit `created_by`/`updated_by`/`deleted_by` pointers) instead of the reverse children that actually cascade, so "related records" always reported zero.

---

## [1.4] — 2026-10-09

### Added
- **Product Import conflict policies** — The Review & Edit modal now offers **Add New**, **Update Existing**, **Skip Duplicates**, and **Replace Existing**, submitted to and enforced by the server.
- **SKU conflict visibility** — Uploaded SKUs are checked against existing records and the file itself; conflicting variants get a red border plus an icon and message, with the existing product/variant/category/brand/warehouse shown inline.
- **Inline revalidation** — Edited SKUs are revalidated server-side (debounced) via a new `products/import/validate/` endpoint; `Update Existing`/`Replace Existing` update in place and keep the same rows, IDs, and history.

### Changed
- **Import quantity column** — The Review & Edit modal has an editable **Qty** column: **Update Existing** adds it to the stock already on hand (80 + 20 = 100), **Replace Existing** sets stock to it (80 → 20), new rows use it as opening stock, and leaving it blank never changes stock. Every stock write is version-bumped and recorded in `InventoryTransaction` (`ADD_STOCK`/`ADJUSTMENT`/`INITIAL`, `source_document_type=PRODUCT_IMPORT`). Negative quantities are rejected before any write.
- **Skipped rows stay editable** — Under **Skip Duplicates**, conflicting rows are dimmed and labelled **Skipped**, but remain editable (full opacity on hover/focus) so the SKU can be fixed or the policy switched.

### Fixed
- **Duplicate SKU did not identify the existing product** — Import now returns the existing product/variant details for conflicting SKUs (company + branch scoped).
- **Technical database errors shown on import** — SKU conflicts return friendly, row-scoped messages; raw SQL/constraint text is logged server-side only.

---

## [1.3] — 2026-07-21

### Added
- **Product Export to XLSX** — Export all products to Excel (.xlsx) with variant-level rows including product details, pricing, stock levels, and source tracking.
- **Product Import from XLSX/CSV** — Import products via spreadsheet with parse → review → confirm flow. Auto-generates SKU for missing values, creates brands/categories on-the-fly, initializes stock items in default warehouse.
- **Source tracking on Brand/Category/Product** — New `source` field to track whether records were created via manual entry or Excel/CSV import.
- **Most recent first** — Brand, Category, and Product listing pages now show newest records at the top by default.
- **Enhanced product search** — Product search now covers product name, description, variant title, SKU, and barcode across all variants.

### Fixed
- **User update 400 error** — Resolved error when updating user without reselecting department/designation. Empty values are now stripped before submission.
- **COMPANY_ADMIN department/designation** — COMPANY_ADMIN users no longer require department/designation fields; fields are hidden from the form.
- **Username updatable** — Username field is now editable on user update.
- **Import parse NaN crash** — Fixed `_resolve_brand_or_category` crash when pandas returns `float('nan')` instead of a string.
- **Non-JSON error responses** — Frontend `apiFetch` now handles non-JSON server responses gracefully with user-friendly error messages.

---

## [1.2] — 2026-07-20

### Added
- **Terms & Conditions submodule** — New settings page for managing terms and conditions templates
- **Print/PDF on Quote & Invoice** — Generate printable PDF versions with attached Terms & Conditions
- **POS Sale → Invoice integration** — Point-of-sale transactions now attach to invoices and update accounting accordingly

### Fixed
- **Finance vendor billing** — Resolved bugs in supplier bill management within the finance module

### Enhanced
- **Company Settings profile** — Improved company configuration page with better UX

---

## [1.1] — 2026-07-19

### Added
- **Lead enhancements**
  - New fields: `priority`, `source`, `score`
  - Status flow: `NEW → CONTACTED → FOLLOW_UP → QUALIFIED → CONVERTED / LOST`
- **Quote enhancements**
  - `send_to_customer` action with mark-as-viewed tracking
- **Invoice enhancements**
  - Manual item selection for invoice lines
- **Vendor enhancements**
  - New fields: `balance`, `credit` tracking on supplier records

---

## [1.0] — 2026-07-18

### Added
- **Initial system build and delivery**
- Full navigation menu with all modules and submodules operational:
  - Human Resources (employees, payroll, leave, shifts, assets, recruitment, exit, policies, performance)
  - Inventory (dashboard, products, categories, brands, warehouses, stock, purchases, suppliers, customers, transfers, audit, POS, barcode, alerts, reports)
  - Sales (dashboard, leads, quotes, customers, invoices)
  - Finance (dashboard, accounts, journal entries, customer invoices, supplier bills, payments, expenses, budgets, bank accounts, reports, payroll, audit, forecasting, assets)
  - AI Monitoring (dashboard, activity tracking, inventory monitoring, workforce monitoring, alerts & events, reports, camera configuration, warehouse)
  - Settings (company, users, departments, designations, permissions, preferences)
- Multi-tenant RBAC with permission-filtered sidebar
- JWT cookie-based authentication with auto-refresh
- WebSocket real-time notifications and permission sync
- Soft-delete architecture across all business entities
- Company/branch data isolation throughout
