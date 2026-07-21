# Changelog

All notable changes to the **Al Qaiser Nexus ERP (Al-Qaiser BOS)** project.

---

## [1.3] — 2026-07-21

### Added
- **Product Export to XLSX** — Export all products to Excel (.xlsx) with variant-level rows including product details, pricing, stock levels, and source tracking.
- **Product Import from XLSX/CSV** — Import products via spreadsheet with parse → review → confirm flow. Auto-generates SKU for missing values, creates brands/categories on-the-fly, initializes stock items in default warehouse.
- **Source tracking on Brand/Category/Product** — New `source` field to track whether records were created via manual entry or Excel/CSV import.

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
