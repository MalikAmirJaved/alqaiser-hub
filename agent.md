# AGENT.md — Al Qaiser Nexus ERP (Al-Qaiser BOS)

This document is the single source of truth for the **Al Qaiser Nexus ERP** codebase.
It is derived exclusively from the current code. Do not rely on assumptions or
external documentation if they conflict with what is written here.

---

## 1. Project Overview

**Nexus ERP** (also called "Al-Qaiser BOS") is a multi-tenant enterprise resource
planning platform. It manages business workflows across HR, Inventory, Finance,
Sales, AI Monitoring, and Settings — all within strict company/branch data
isolation.

### High-Level Architecture

```
Browser (Next.js 16 App Router)
  │  HTTP REST (Cookie-based JWT)
  │  WebSocket (Notifications + Permissions)
  ▼
Daphne (ASGI server, port 8000)
  │
  ├── HTTP → Django REST Framework (JSON-only)
  ├── WS   → Django Channels (NotificationConsumer, PermissionConsumer)
  │
  ├── PostgreSQL (primary DB)
  ├── Redis DB 0 (Channels layer for WebSocket)
  ├── Redis DB 1 (Cache: permissions, code generation, general)
  └── Celery (forecast tasks, daily beat schedule)
```

### Technology Stack

| Layer          | Technology                                                  |
| -------------- | ----------------------------------------------------------- |
| Frontend       | Next.js 16 (App Router), React 19, TypeScript 5.8           |
| Styling        | Tailwind CSS v4, shadcn/ui (New York style)                 |
| State (client) | Redux Toolkit (auth, theme, permissions, settings)          |
| State (server) | TanStack React Query v5                                     |
| Forms          | React Hook Form v7 + Zod v3, or legacy schemas.js           |
| Rich Text      | TipTap v3 (policy content editor)                           |
| Animations     | Framer Motion v12                                           |
| Video          | HLS.js v1.6 (CCTV HLS stream playback)                      |
| PDF/Export     | jsPDF, react-pdf, html2canvas, xlsx, mammoth (DOCX), pandas (Excel/CSV backend) |
| Backend        | Python 3.12, Django 6.0.4, DRF 3.17.1, Channels 4.1.0      |
| ASGI Server    | Daphne 4.1.2                                                |
| WSGI Server    | Gunicorn 21.2.0 (fallback)                                  |
| Auth           | Cookie-based JWT (simplejwt 5.3.1)                          |
| Filters        | django-filter 25.1                                          |
| Database       | PostgreSQL (psycopg2-binary 2.9.12)                         |
| Cache/WS       | Redis 7 (django-redis 5.4.0, channels-redis 4.2.0, hiredis 2.2.3) |
| Task Queue     | Celery 5.6.3 + Redis (beat for daily forecast tasks)        |
| ML/Analytics   | pandas 3.0.3, numpy 2.4.6, opencv-python-headless           |
| System Deps    | ffmpeg (HLS/stream processing)                              |
| Container      | Docker + Docker Compose, multi-stage builds                 |
| Package Mgr    | npm (frontend), pip (backend)                               |
| Env Mgr        | django-environ 0.13.0                                       |
| Seed Data      | faker (development seeding)                                 |

---

## 2. Repository Structure

```
alqaiser/
├── agent.md                        ← YOU ARE HERE
├── docker-compose.yml              ← dev orchestration
├── docker-compose.prod.yml         ← production orchestration
├── .env                            ← shared env (frontend/backend vars)
├── .gitignore
│
├── backend/                        ← Django project root
│   ├── config/                     ← project configuration
│   │   ├── settings.py             ← 14 internal apps, 10 middleware, DRF, JWT, CORS, Redis
│   │   ├── urls.py                 ← root URL router → 14 app prefixes under /api/
│   │   ├── asgi.py                 ← ProtocolTypeRouter (HTTP + WS with JWT auth)
│   │   ├── wsgi.py                 ← fallback WSGI
│   │   ├── celery.py               ← Celery app + beat schedule
│   │   └── test_runner.py          ← custom test runner (unused in settings)
│   ├── apps/
│   │   ├── accounts/               ← login, logout, refresh, me endpoints
│   │   ├── audit/                  ← signal-based audit logging
│   │   ├── common/                 ← shared foundation: BaseModel, auth, pagination
│   │   │   ├── basemodel.py        ← abstract BaseModel (UUID, tenant cols, soft-delete)
│   │   │   ├── authentication.py   ← CookieJWTAuthentication
│   │   │   ├── backends.py         ← EmailOrUsernameBackend
│   │   │   ├── baseauthentication.py → CompanyBranchMixin
│   │   │   ├── middleware.py       ← CurrentRequestMiddleware (thread-local)
│   │   │   ├── pagination.py       ← StandardPagination (page-based)
│   │   │   ├── exceptions.py       ← custom_exception_handler
│   │   │   ├── filters.py          ← FilterPaginationMixin, GenericFilterMixin
│   │   │   ├── serializer_fields.py → UUIDForeignRelatedField
│   │   │   ├── views.py            ← GenerateCodeView, ValidateCodeView, FileUploadView
│   │   │   ├── urls.py
│   │   │   └── test_base.py        ← BaseTestCase, UnauthenticatedTestCase
│   │   ├── compsetting/            ← company settings, working days, holidays
│   │   ├── finance/                ← accounts, journal, invoices, payments, budgets
│   │   │   ├── models/             ← package (8 files): account.py, bank.py, budget.py, customer_invoice.py, expense.py, journal.py, payment.py, supplier_bill.py
│   │   │   ├── serializers/        ← 9 serializer files
│   │   │   ├── services/           ← document, invoice_payment, payable
│   │   │   ├── views/              ← 13 view files
│   │   │   └── integration_signals.py
│   │   ├── forecast/               ← sales & stock forecasting
│   │   │   ├── analytics.py
│   │   │   ├── services.py         ← DemandForecaster, StockForecaster
│   │   │   └── tasks.py            ← Celery tasks (daily at 02:00 / 03:00 UTC)
│   │   ├── hr/                     ← employees, shifts, leave, payroll, assets, recruitment, policies, exit
│   │   │   ├── serializers/        ← 6 serializer files: asset, asset_purchase_request, policy, recruitment, shift
│   │   │   ├── services/           ← assignment_service, shift_service
│   │   │   └── views/              ← 15 view files
│   │   ├── inventory/              ← products, variants, stock, warehouses, PO, SO, transfers, barcode, alerts
│   │   │   ├── models/             ← 17 model files: alert, audit, brand, category, customer, product, purchase, reservation, sales, stock, supplier, transaction, transfer, variant, variant_attribute, variant_image, warehouse
│   │   │   ├── serializers/        ← 19 serializer files
│   │   │   ├── services/           ← stock_service
│   │   │   ├── views/              ← 19 view files
│   │   │   ├── audit.py            ← ThreadPoolExecutor-based audit engine
│   │   │   ├── alert_utils.py      ← WebSocket alert helper
│   │   │   ├── signals_audit.py    ← pre-save/post-save/post-delete signals
│   │   │   └── views/product_import_export.py ← Export (xlsx/csv), Import parse/confirm, template generator
│   │   ├── monitoring/             ← AI monitoring (sites, NVRs, cameras, HLS streams)
│   │   ├── notifications/          ← WebSocket notification subsystem
│   │   │   ├── consumers.py        ← NotificationConsumer (AsyncWebsocketConsumer)
│   │   │   ├── middleware.py       ← JWTAuthCookieMiddleware
│   │   │   ├── registry.py         ← model registration for auto-broadcast
│   │   │   ├── routing.py          ← WS URL patterns
│   │   │   └── utils.py            ← broadcast_data_update helper
│   │   ├── organization/           ← Company, Branch, Custom User (+ Department)
│   │   ├── overall_dashboard/      ← cross-module KPI endpoint (summary, trends, recent_activity, alerts actions)
│   │   ├── permissions/            ← RBAC engine (Module, Resource, Action, Permission, Role, UserRole, UserPermission)
│   │   │   ├── checks.py           ← check_permission, require_permission
│   │   │   ├── mixins.py           ← PermissionRequiredMixin (DRF)
│   │   │   ├── services.py         ← PermissionService (Redis-backed cache)
│   │   │   ├── signals.py          ← cache invalidation + WS broadcast on change
│   │   │   └── views_extended.py   ← role assignment, overrides, bulk management
│   │   └── sales/                  ← leads, quotes, invoices, dashboard
│   │       ├── models/             ← package: lead.py, quote.py, status_history.py
│   │       │   ├── __init__.py     ← exports Lead, Quote, QuoteLine, SalesStatusHistory
│   │       │   ├── lead.py         ← Lead (pipeline: NEW→CONTACTED→QUALIFIED→FOLLOW_UP→CONVERTED/LOST)
│   │       │   ├── quote.py        ← Quote + QuoteLine
│   │       │   └── status_history.py ← SalesStatusHistory (entity_type, from_status, to_status)
│   │       ├── serializers/
│   │       └── views/
│   ├── consumers/
│   │   └── permission_consumer.py  ← PermissionConsumer (AsyncWebsocketConsumer)
│   ├── upload/                     ← user-uploaded files (company logos, employee docs, product images)
│   ├── manage.py
│   ├── requirements.txt
│   ├── entrypoint.sh               ← wait-for-db, collectstatic, daphne start
│   └── Dockerfile                  ← python:3.12-slim, multi-stage
│
└── frontend/                       ← Next.js 16 project
    ├── package.json                ← scripts: dev, build, start, lint
    ├── next.config.mjs              ← standalone output, security headers, bundle analyzer
    ├── tsconfig.json                ← @/* → ./src/*, strict mode
    ├── components.json              ← shadcn/ui (new-york, rsc: false)
    ├── bunfig.toml
    ├── postcss.config.mjs
    ├── eslint.config.js             ← flat config, TS + React Hooks
    ├── Dockerfile
    ├── .env                         ← NEXT_PUBLIC_API_URL
    └── src/
        ├── app/
        │   ├── layout.tsx           ← root layout (Inter font, providers: ReactQuery[Redux + QueryClient] → ThemeInit → Confirmation → Notification → Toaster)
        │   ├── providers.tsx         ← ReactQueryProvider wraps Redux Provider + QueryClient (5 min staleTime, 1 retry)
        │   ├── (app)/               ← authenticated route group
        │   │   ├── layout.tsx       ← delegates to AppLayout (sidebar + topbar shell)
        │   │   ├── page.tsx         ← redirect / → /dashboard
        │   │   ├── dashboard/       ← overall dashboard
        │   │   ├── hr/              ← 22 route files
        │   │   ├── inventory/       ← 23 route files
        │   │   ├── finance/         ← 23 route files
        │   │   ├── sales/           ← 9 route files
        │   │   ├── monitoring/      ← 8 route files
        │   │   └── settings/        ← 9 route files
        │   ├── login/
        │   ├── unauthorized/
        │   └── demo/
        ├── components/
        │   ├── ui/                  ← 49 shadcn/ui primitives (button, dialog, table, card, form, select, dropdown-menu, drawer, popover, tooltip, etc.)
        │   ├── reuseable/           ← older reusable components
        │   │   └── final/           ← DynamicModulePage, DetailLayout, workflow (newer patterns)
        │   ├── sidebar/Sidebar.tsx  ← permission-filtered sidebar
        │   ├── navbar/Topbar.tsx    ← search, theme toggle, notification bell, user menu
        │   ├── CrudPage.tsx         ← legacy generic CRUD (localStorage-based)
        │   ├── PermissionGuard.tsx  ← route-level permission guard
        │   ├── PageHeader.tsx
        │   └── finance/, inventory/, sales/, payroll/, leave/, HRAssets/, monitoring/, recruitment/, settings/, Forms/, cards/, common/
├── hooks/                   ← 79 hooks (58 root + 16 finance + 4 sales + 1 overall)
│   ├── finance/             ← 16 hooks (accounts, budgets, expenses, payments, supplier bills, customer invoices, journal entries, bank, trial balance, P&L, balance sheet, aging reports, expense report, audit logs, finance dashboard, forecast)
│   ├── sales/               ← 4 hooks (leads, quotes, sales invoices, sales dashboard)
│   ├── overall/             ← 1 hook (overall dashboard)
│   └── useProductExportImport.ts ← Export, Import-parse, Import-confirm mutations
        ├── config/
        │   ├── menu.js              ← sidebar menu structure
        │   ├── routePermissions.ts  ← route → permission mapping
        │   ├── schemas.js           ← legacy form field definitions (1456 lines)
        │   └── monitoringFeeds.js   ← dummy CCTV feed URLs
        ├── contexts/
        │   ├── NotificationContext.tsx  ← WebSocket client, cache invalidation, fallback polling
        │   └── ConfirmationModalContext.tsx → global confirm() dialog
        ├── store/
        │   ├── index.ts             ← Redux store (auth, theme, permissions, companySettings)
        │   ├── reset.ts             ← RESET_APP action for full state wipe
        │   └── slices/              ← authSlice, permissionSlice, themeSlice, companySettingsSlice
        ├── lib/
        │   ├── api.ts               ← apiFetch (fetch-based, cookie auth, auto-refresh, toast)
        │   ├── permissions.ts       ← PERMISSIONS registry + utility functions
        │   ├── notifications.ts     ← ServiceWorker + desktop notification helpers
        │   └── utils.ts             ← cn() helper
        ├── layouts/
        │   └── AppLayout.tsx        ← auth check, permission loading, route guard, sidebar+topbar shell
        ├── types/                   ← policy.ts, purchase.ts, shifts.ts
        └── seed/initializeSystem.js ← system bootstrap script
```

---

## 3. Business Domains & Modules

```
Nexus ERP
├── Organization (cross-cutting)
│   ├── Company          — tenant root
│   ├── Branch           — company branch/location
│   ├── Department       — organizational unit (inherits BaseModel)
│   └── User             — custom AbstractUser with company/branch FK + role
│
├── HR
│   ├── Employee         — core employee record (30+ fields, linked to User)
│   ├── EmployeeDocument — education, experience, other documents
│   ├── EmployeePromotion — salary promotion history
│   ├── Payroll          — PayrollRecord + PayrollDeductionDetail, PayrollCompensation, PayrollLoanDeduction, PayrollLeaveDeduction (relational links)
│   ├── Leave            — LeaveRequest with approval workflow
│   ├── Shift Management — ShiftTemplate, ShiftOverride, ShiftDateRangeAssignment, EmployeeDefaultShift, ShiftChangeHistory, EmployeeShiftSchedule
│   ├── Assets           — Asset (inventory items), AssetCategory (kits), AssetPurchaseRequest, EmployeeAssetAssignment
│   ├── Recruitment      — RecruitmentCandidate, RecruitmentActivityLog, InterviewRound
│   ├── Exit Management  — ExitRecord + ExitChecklist
│   ├── Policies         — Policy with versioning (PolicyVersion, PolicyCategory)
│   └── Compensation     — Compensation (+ CompensationSelectedMonth, CompensationMonthRange), EmployeeLoan (+ LoanSelectedMonth, LoanMonthRange)
│
├── Inventory
│   ├── Products         — Product + ProductVariant + VariantAttribute + VariantImage
│   ├── Stock            — StockItem (per-variant per-warehouse), InventoryTransaction, StockReservation
│   ├── Warehouses       — physical locations
│   ├── Purchases        — PurchaseOrder + PurchaseOrderLine + GoodsReceipt + GoodsReceiptLine
│   ├── Sales            — SalesOrder + SalesOrderLine + SalesReturn + SalesReturnLine
│   ├── Transfers        — StockTransfer between warehouses
│   ├── Suppliers        — Supplier + SupplierHistory (transaction ledger)
│   ├── Customers        — Customer records
│   ├── Categories       — Product categories (hierarchical)
│   ├── Brands           — Product brands
│   ├── Barcodes         — barcode generation/printing
│   ├── Alerts           — low stock, movement alerts with severity
│   ├── Audit            — AuditLog + AuditFieldChange (separate engine from audit app)
│   └── POS              — point-of-sale cart, return, thermal receipt
│
├── Finance
│   ├── Accounts         — Chart of Accounts (hierarchical, 5 types)
│   ├── Journal          — JournalEntry + JournalLine (double-entry)
│   ├── Customer Invoices — invoice generation linked to sales orders
│   ├── Supplier Bills   — bill tracking linked to purchase orders
│   ├── Payments         — polymorphic payments (GenericForeignKey to payable models)
│   ├── Expenses         — categorized expenses (13 categories)
│   ├── Budgets          — per-account period budgets (monthly/quarterly/yearly)
│   ├── Bank Accounts    — BankAccount with book/cleared balance tracking + BankTransaction
│   ├── Payroll          — finance-side payroll views (PayrollRecord inherits PayableModelMixin)
│   └── Reports          — trial balance, P&L, balance sheet, aging reports
│
├── Sales
│   ├── Leads            — pipeline (NEW → CONTACTED → QUALIFIED → FOLLOW_UP → CONVERTED/LOST)
│   ├── Quotes           — DRAFT → SENT → APPROVED/REJECTED → CONVERTED (with QuoteLine details)
│   └── Invoices         — sales customer invoices
│
├── AI Monitoring
│   ├── Live Dashboard   — CCTV feeds, workforce/inventory monitoring
│   ├── Sites            — monitored locations (monitoring_sites table: name, location)
│   ├── NVRs             — network video recorders (FK → Site, monitoring_nvrs table: nvr_name, ip, port)
│   └── Cameras          — camera configuration (FK → Nvr, monitoring_cameras table: channel, zone, purpose)

├── Forecasting
│   ├── Configuration    — ForecastConfiguration (scope: GLOBAL/VARIANT/CATEGORY, method: MOVING_AVERAGE/EXPONENTIAL_SMOOTHING/LINEAR_REGRESSION)
│   ├── Sales Forecast   — SalesForecast (per-variant, predicted_quantity + confidence bounds), daily Celery task (02:00 UTC)
│   └── Stock Forecast   — StockForecast (per-variant per-warehouse, projected_closing_stock + required_purchase_qty), daily Celery task (03:00 UTC)
│
├── Permissions (RBAC)
│   ├── Modules          — 7 modules (HR, INVENTORY, FINANCE, SALES, AI_MONITORING, SETTINGS, NOTIFICATIONS)
│   ├── Resources        — per-module features (employee, product, account, lead, etc.)
│   ├── Actions          — create, view, update, delete, export + 30+ domain-specific actions
│   ├── Roles            — COMPANY_ADMIN (*), BRANCH_ADMIN, STAFF
│   ├── User Overrides   — per-user grant/deny with expiry
│   └── Audit Log        — PermissionAuditLog tracks all changes
│
├── Notifications (real-time)
│   ├── WebSocket        — per-company/branch/personal channels
│   ├── Data Updates     — cache invalidation via data_update messages
│   └── Desktop          — Service Worker + browser Notification API
│
├── Audit Logging
│   ├── Global           — apps/audit: signal-based, tracks CREATE/UPDATE/DELETE on all models with _id
│   └── Inventory        — apps/inventory/audit.py: ThreadPoolExecutor-based, field-level changes
│
├── Settings
│   ├── Company Profile  — company configuration
│   ├── Users            — user management
│   ├── Departments      — department CRUD
│   ├── Designations     — designation CRUD
│   ├── Permissions      — role assignment, overrides, audit
│   └── Preferences      — system preferences
│
└── Common (cross-cutting)
    ├── Code Generation  — atomic Redis INCR-based sequential codes
    ├── File Upload      — module-based file organization, thumbnail generation
    └── Location Data    — country/state/city cascading selects
```

---

## 4. Database Design

### 4.1 BaseModel (Abstract Base)

Defined in `apps/common/basemodel.py`. Almost every business model inherits from it.

| Field          | Type            | Purpose                                    |
| -------------- | --------------- | ------------------------------------------ |
| `id`         | BigAutoField PK | integer primary key (joins, performance)   |
| `_id`        | UUIDField       | UUID v4, unique, exposed in APIs           |
| `company_id` | IntegerField    | multi-tenant isolation (db_index)          |
| `branch_id`  | IntegerField    | multi-tenant isolation (db_index)          |
| `created_at` | DateTimeField   | auto_now_add                               |
| `updated_at` | DateTimeField   | auto_now                                   |
| `created_by` | FK → User      | SET_NULL, related_name="%(class)s_created" |
| `updated_by` | FK → User      | SET_NULL, related_name="%(class)s_updated" |
| `deleted_by` | FK → User      | SET_NULL, related_name="%(class)s_deleted" |
| `is_deleted` | BooleanField    | soft-delete flag (default False)           |

**Meta**: `abstract = True`, index on `(company_id, branch_id)`.

### 4.2 Standalone Models (do NOT inherit BaseModel)

- `Company` (organization) — tenant root
- `Branch` (organization) — FK → Company
- `User` (organization) — AbstractUser, FK → Company/Branch
- `UserCompanyContext` (organization) — OneToOne → User
- `ShiftChangeHistory` (hr) — standalone with manual audit fields
- `EmployeeShiftSchedule` (hr) — standalone with manual audit fields
- `InterviewRound` (hr) — standalone
- `All permission models` (permissions) — Module, Resource, Action, Permission, Role, RolePermission, UserRole, UserPermission, PermissionAuditLog, ABACCondition
- `CompanySettings`, `WorkingDay`, `PublicHoliday`, `CompanySettingHistory`, `Designation`, `TermsAndCondition` (compsetting)
- `Notification` (notifications)
- `Alert` (monitoring)
- `AuditLogChange` (audit) — field-level change tracking for AuditLog

### 4.3 Key Relationship Patterns

```
Company 1──N Branch
Company 1──N User
Branch  1──N User
User    N──1 Company (via FK)
User    N──1 Branch  (via FK)

Product 1──N ProductVariant
ProductVariant 1──N VariantAttribute
ProductVariant 1──N VariantImage
ProductVariant N──1 StockItem ──N Warehouse

Supplier 1──N PurchaseOrder 1──N PurchaseOrderLine
PurchaseOrder 1──N GoodsReceipt 1──N GoodsReceiptLine

Customer 1──N SalesOrder 1──N SalesOrderLine
SalesOrder 1──N SalesReturn 1──N SalesReturnLine

Account 1──N JournalEntry 1──N JournalLine
CustomerInvoice ──N CustomerInvoiceLine
SupplierBill ──── (manual lines)
Payment — (GenericForeignKey to payable: CustomerInvoice, SupplierBill, PayrollRecord, Expense)
BankAccount 1──N BankTransaction

Employee 1──N EmployeeDocument
Employee 1──N EmployeePromotion
Employee 1──N LeaveRequest
Employee 1──N PayrollRecord (PayableModelMixin → finance integration)
Employee 1──N Compensation (+ CompensationSelectedMonth, CompensationMonthRange)
Employee 1──N EmployeeLoan (+ LoanSelectedMonth, LoanMonthRange)
Employee 1──N EmployeeAssetAssignment
Employee 1──N RecruitmentCandidate
Employee 1──N ExitRecord
Employee 1──N ExitChecklist (via ExitRecord)
Employee 1──N AssetPurchaseRequest

ShiftTemplate 1──N ShiftOverride
ShiftTemplate 1──N ShiftDateRangeAssignment
ShiftTemplate 1──N EmployeeDefaultShift

AssetCategory M2M Asset
Quote 1──N QuoteLine
Supplier 1──N SupplierHistory

Policy 1──N PolicyVersion
Policy N──1 PolicyCategory

PayrollRecord 1──N PayrollDeductionDetail
PayrollRecord 1──N PayrollCompensation
PayrollRecord 1──N PayrollLoanDeduction
PayrollRecord 1──N PayrollLeaveDeduction
```

### 4.4 Soft Delete

All BaseModel descendants use `is_deleted=True` instead of hard DELETE.
The `CompanyBranchMixin.get_queryset()` automatically filters `is_deleted=False`.
Cascade soft-deletes are implemented manually in view logic (e.g., Product.destroy()
soft-deletes variants, stock items, attributes, images, reservations).

**Note:** `company_id` and `branch_id` on BaseModel are `null=True, blank=True` — some
models (e.g., audit, notifications) may not set these fields.

### 4.5 Indexes

Every model with `company_id`/`branch_id` has a composite index.
Frequently filtered fields (status, is_active, is_deleted) are indexed.
Unique constraint patterns: `unique_together = [['company_id', 'branch_id', 'code']]`
for entities with user-facing codes.

---

## 5. Backend Architecture

### 5.1 ViewSet Pattern

The standard ViewSet pattern across the codebase is:

```python
class EntityViewSet(
    GenericFilterMixin,      # declarative filter_fields support (apps/common/filters.py)
    CompanyBranchMixin,      # auto-filter by company_id/branch_id/is_deleted (apps/common/baseauthentication.py)
    PermissionRequiredMixin, # DB-backed RBAC enforcement (apps/permissions/mixins.py)
    SoftDeleteMixin,         # optional: override destroy() for soft delete
    viewsets.ModelViewSet    # standard CRUD
):
    permission_module = 'MODULE_CODE'    # e.g. 'INVENTORY'
    permission_resource = 'resource_key' # e.g. 'product'
    queryset = EntityModel.objects.all()
    serializer_class = EntitySerializer
    lookup_field = '_id'                 # UUID-based lookups
    filter_fields = {
        'search': ['field1', 'field2'],
        'category': 'category___id',     # triple-underscore → FK._id
    }

    def create(self, request, *args, **kwargs):
        # Override to add custom success message
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            "success": True,
            "message": "Entity created successfully",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_deleted = True
        instance.save()
        return Response({"success": True, "message": "Entity deleted"})
```

### 5.2 APIView Pattern (used in HR)

HR views use `APIView` (not ModelViewSet) due to complex serialization:

```python
class EntityView(CompanyBranchMixin, PermissionRequiredMixin, FilterPaginationMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'employee'
    filterset_class = EmployeeFilter
    search_fields = ['first_name', 'last_name', 'email']
    ordering_fields = ['first_name', 'joining_date']

    def get(self, request):
        qs = self.get_queryset()
        qs = self.filter_queryset(qs)
        qs = self.search_queryset(qs)
        qs = self.order_queryset(qs)
        page = self.paginate_queryset(qs)
        serializer = EmployeeSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = EmployeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response({"success": True, "data": serializer.data}, status=201)
```

### 5.3 Router Pattern

Each app uses DRF `DefaultRouter` in its `urls.py`:

```python
router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
urlpatterns = [path('', include(router.urls))]
```

The root `config/urls.py` includes each app under `/api/<app>/`.

### 5.4 Response Format

**Success:**

```json
{ "success": true, "message": "...", "data": { ... } }
```

**Paginated:**

```json
{ "count": N, "total_pages": N, "current_page": N, "next": "...", "previous": null, "results": [...] }
```

**Error:**

```json
{ "detail": "human readable", "errors": { "field": ["..."] } }
```

### 5.5 Authentication

- Custom `CookieJWTAuthentication` reads JWT from `access_token` HttpOnly cookie
- Falls back to `Authorization: Bearer <token>` header
- Login sets `access_token` + `refresh_token` cookies
- Refresh endpoint reads `refresh_token` cookie, sets new `access_token`
- Logout clears cookies
- Custom `EmailOrUsernameBackend` allows login via email or username

### 5.6 Multi-Tenancy

Enforced by `CompanyBranchMixin.get_queryset()`:

- Always filters `company_id = request.user.company_id`
- If model has `is_deleted` → filter `is_deleted=False`
- `COMPANY_ADMIN` role sees all branches
- Other roles scoped to `branch_id = request.user.branch_id`
- `branch_filter_enabled` toggle for views that need cross-branch access

### 5.7 Permissions (RBAC Engine)

**Models (apps/permissions/models.py):**

- `Module` → `Resource` → `Action` → `Permission(code = "MODULE:resource:action")`
- `Role` groups permissions via `RolePermission` (has `is_system` flag for system roles)
- `UserRole` maps users to roles
- `UserPermission` per-user override (grant/deny with expiry)
- `PermissionAuditLog` tracks all permission changes
- `ABACCondition` — future ABAC extension: dynamic attribute-based rules per permission

**Resolution order (PermissionService.user_has_permission):**

1. Superuser → always True
2. UserPermission override → immediate return
3. Role permissions → batch check all user's roles
4. All results cached in Redis with 5-min TTL

**DRF Integration:** `PermissionRequiredMixin.check_permissions()` resolves the
action from the viewset action name → permission action mapping
(`VIEWSET_ACTION_TO_PERMISSION` + `CUSTOM_ACTION_TO_PERMISSION` dicts).

**WebSocket Sync:** Signal handlers on UserPermission/UserRole/RolePermission
invalidate cache + broadcast via PermissionConsumer.

### 5.8 WebSocket Architecture

**ASGI Router (config/asgi.py):**

```
ProtocolTypeRouter
├── http → get_asgi_application()
└── websocket → OriginValidator(
        JWTAuthCookieMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    )
```

**WS URL Patterns:**

- `ws/notifications/<company_id>/<branch_id>/` — company + branch notifications
- `ws/notifications/<company_id>/` — company-only notifications
- `ws/notifications/personal/` — user-specific notifications
- `ws/permissions/` — permission change broadcasts

**NotificationConsumer** (apps/notifications/consumers.py):

- Joins room: `notify_c{company_id}_b{branch_id}`
- Message types: `notification` (new alert), `data_update` (cache invalidation)

**PermissionConsumer** (consumers/permission_consumer.py):

- Joins: `permissions_global` + `user_permissions_{user.id}`
- Message types: `permission_changed`, `role_changed`, `self_permission_changed`

### 5.9 Signals

- `apps/audit/signals.py` — post_save/pre_delete on all models with `_id` UUID
- `apps/notifications/signals.py` — auto-broadcast data_update on registered model changes
- `apps/permissions/signals.py` — cache invalidation + WS broadcast on RBAC changes
- `apps/inventory/signals_audit.py` — inventory-specific audit tracking
- `apps/finance/signals.py` — finance integration signals
- `apps/finance/integration_signals.py` — additional finance integration

### 5.10 Celery

- **App:** config/celery.py (autodiscover_tasks)
- **Beat schedule:**
  - `generate-sales-forecast-daily` → `forecast.tasks.generate_sales_forecasts_for_all_companies` (02:00 UTC)
  - `generate-stock-forecast-daily` → `forecast.tasks.generate_stock_forecasts_for_all_companies` (03:00 UTC)
- **NOTE:** Celery worker and beat are NOT started by entrypoint.sh. They require separate containers/processes.

### 5.11 Environment Variables (backend)

| Variable                                        | Default                         | Description                    |
| ----------------------------------------------- | ------------------------------- | ------------------------------ |
| `SECRET_KEY`                                  | (required)                      | Django secret key              |
| `DEBUG`                                       | `False`                       | Debug mode                     |
| `FRONTEND_URL`                                | `http://localhost:3000`       | CORS + WS origin               |
| `ALLOWED_HOSTS`                               | `localhost,127.0.0.1,0.0.0.0` | Allowed hosts                  |
| `JWT_SECRET_TIME_EXP_MINUTES`                 | `10`                          | Access token TTL               |
| `JWT_REFRESH_TIME_EXP_DAYS`                   | `15`                          | Refresh token TTL              |
| `DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT` | —                              | PostgreSQL connection          |
| `REDIS_HOST/REDIS_PORT`                       | `redis`, `6379`             | Redis connection               |
| `PERMISSION_CACHE_TTL`                        | `300`                         | Permission cache TTL (seconds) |
| `ORG_COMPANY_NAME/SHORT/BRANCH_NAME/CODE`     | —                              | Seed data                      |
| `ORG_ADMIN_USERNAME/EMAIL/PASSWORD`           | —                              | Seed admin credentials         |
| `ORG_WAREHOUSE_CODE/NAME`                     | —                              | Seed warehouse                 |
| `APP_HOST` (docker-compose)                   | —                              | Bind address for services (e.g. `192.168.88.51`) |

---

## 6. Frontend Architecture

### 6.1 Route Structure (Next.js App Router)

```
/                              → redirect /dashboard
/login                         → LoginPage (public)
/unauthorized                  → Access Denied (public)
/dashboard                     → App Home
/hr/employees                  → Employee list
/hr/employees/[id]             → Employee detail
/hr/payroll                    → HR Payroll
/hr/payroll/[id]               → Payroll detail
/hr/leave                      → Leave management
/hr/attendance                 → Attendance
/hr/shifts/list                → Shift overrides
/hr/shifts/templates           → Shift templates
/hr/compensation               → Compensation list
/hr/compensation/[id]          → Compensation detail
/hr/compensation/loan/[id]     → Loan detail
/hr/assets/list                → HR Assets list
/hr/assets/list/[id]           → Asset detail
/hr/assets/kits                → Asset categories
/hr/assets/kits/[id]           → Kit detail
/hr/assets/employee-assets     → Employee asset assignments
/hr/recruitment                → Recruitment
/hr/exit                       → Exit management
/hr/exit/[id]                  → Exit detail
/hr/policies                   → Policies list
/hr/policies/[id]              → Policy detail
/hr/performance                → Performance
/inventory/dashboard           → Inventory dashboard
/inventory/products            → Product list
/inventory/products/[id]       → Product detail
/inventory/categories          → Categories
/inventory/brands              → Brands
/inventory/warehouses          → Warehouse list
/inventory/warehouses/[id]     → Warehouse detail
/inventory/stock               → Stock levels
/inventory/stock/[id]          → Stock detail
/inventory/purchases           → Purchase orders
/inventory/purchases/[id]      → Purchase order detail
/inventory/suppliers           → Supplier list
/inventory/suppliers/[id]      → Supplier detail
/inventory/customers           → Customer list (inventory)
/inventory/customers/[id]      → Customer detail
/inventory/transfers           → Stock transfers
/inventory/transfers/[id]      → Transfer detail
/inventory/audit               → Inventory audit logs
/inventory/audit/[id]          → Audit detail
/inventory/pos                 → Point of Sale
/inventory/barcode             → Barcode generation
/inventory/alerts              → Inventory alerts
/inventory/reports             → Inventory reports
/sales/dashboard               → Sales dashboard
/sales/leads                   → Lead list
/sales/leads/[id]              → Lead detail
/sales/quotes                  → Quote list
/sales/quotes/[id]             → Quote detail
/sales/customers               → Sales customers
/sales/customers/[id]          → Customer detail
/sales/customer-invoices       → Sales customer invoices
/sales/customer-invoices/[id]  → Invoice detail
/finance/dashboard             → Finance dashboard
/finance/accounts              → Chart of accounts
/finance/accounts/[id]         → Account detail
/finance/journal-entries       → Journal entries
/finance/journal-entries/[id]  → Journal entry detail
/finance/customer-invoices     → Customer invoices
/finance/customer-invoices/[id] → Invoice detail
/finance/supplier-bills        → Supplier bills
/finance/supplier-bills/[id]   → Bill detail
/finance/payments              → Payments
/finance/payments/[id]         → Payment detail
/finance/expenses              → Expenses
/finance/expenses/[id]         → Expense detail
/finance/budgets               → Budgets
/finance/bank-accounts         → Bank accounts
/finance/reports               → Finance reports
/finance/payroll               → Finance payroll
/finance/audit                 → Finance audit logs
/finance/audit/[id]            → Audit detail
/finance/forecast              → Forecasting
/finance/forecasting           → Forecasting (duplicate)
/finance/assets                → Finance assets
/finance/taxes                 → Taxes (placeholder)
/monitoring/dashboard          → Monitoring dashboard
/monitoring/activity-tracking  → Activity tracking
/monitoring/inventory-monitoring → Inventory monitoring
/monitoring/workforce-monitoring → Workforce monitoring
/monitoring/alerts-events      → Alerts & events
/monitoring/reports-insights   → Reports
/monitoring/camera-configuration → Camera config
/monitoring/warehouse          → Warehouse monitoring
/settings/company              → Company profile
/settings/users                → User management
/settings/departments          → Departments
/settings/departments/[id]     → Department detail
/settings/designations         → Designations
/settings/designations/[id]    → Designation detail
/settings/permissions          → Permission management
/settings/preferences          → Preferences
/settings/terms                → Terms & conditions
```

### 6.2 Provider Hierarchy (layout.tsx)

```
<html>
  <body className={inter.variable}>
    ReactQueryProvider                     ← client wrapper: Redux + React Query
      <Provider store={store}>             ← Redux
        QueryClientProvider                ← TanStack Query (5min staleTime, 1 retry, refetchOnWindowFocus: false)
          ThemeInitializer                  ← sets dark/light class on <html> (standalone component)
          ConfirmationProvider              ← global confirm() dialog
            NotificationProvider            ← WebSocket connection + cache invalidation
              {children}
            <Toaster position="top-right" .../>  ← Sonner toasts
```

### 6.3 State Management

**Redux (client state):**

| Slice                    | Key State                                                      | Async Thunk               |
| ------------------------ | -------------------------------------------------------------- | ------------------------- |
| `authSlice`            | `user`, `isAuthenticated`, `isInitialized`               | — (manual dispatch)      |
| `themeSlice`           | `theme` (light/dark)                                         | —                        |
| `permissionSlice`      | `permissions[]`, `modules[]`, `loading`, `initialized` | `loadPermissions()`     |
| `companySettingsSlice` | `data`, `loading`, `initialized`, `error`              | `loadCompanySettings()` |

**TanStack React Query (server state):**
All CRUD data is fetched via custom hooks wrapping `useQuery`/`useMutation`.
Cache keys follow the pattern `[entity_name]` for lists, `[entity_name, id]` for details.

### 6.4 API Client (src/lib/api.ts)

Custom `apiFetch<T>()` using native `fetch`:

- `credentials: "include"` (cookie-based auth)
- JSON Content-Type by default
- Auto-refresh on 401 (reads refresh_token cookie, retries once)
- Session clear on refresh failure (POST /api/accounts/logout/, wipe state, redirect /login)
- Automatic toast for mutations (success for POST/PUT/PATCH/DELETE, error for failures)
- Skip endpoints: token refresh, login, logout (toast suppression list)
- Refresh deduplication via singleton promise

### 6.5 Permission System (Frontend)

**Data Flow:**

1. AppLayout mounts → dispatches `loadPermissions()` thunk if not initialized
2. Thunk fetches `/api/permissions/me/` (flat string[]) + `/api/permissions/modules/` (tree)
3. Redux stores both in `permissionSlice`
4. `Sidebar` filters menu items using `permissions[]` + `routePermissions.ts`
5. `AppLayout` guards routes via `getRequiredPermission(pathname)`
6. `PermissionGuard` component provides in-page fallback for nested content
7. `usePermissionSocket` WS hook syncs changes in real-time (debounced 300ms)

**Route Permission Mapping** (`src/config/routePermissions.ts`):

```typescript
const routePermissions = {
  "/hr/employees": "HR:employee:view",
  "/inventory/products": "INVENTORY:product:view",
  // ... ~40+ route mappings
};
const publicRoutes = ["/login", "/unauthorized"];
```

### 6.6 Real-Time Notifications (Frontend)

**NotificationContext** (src/contexts/NotificationContext.tsx):

- Connects to `ws://<api>/ws/notifications/<companyId>/<branchId>/`
- Exponential backoff reconnection (max 10 retries, 30s max delay)
- Heartbeat ping every 30s
- Message handlers:
  - `notification` → prepend to state, show desktop notification
  - `data_update` → `queryClient.invalidateQueries()` using ENTITY_TO_QUERY_KEY mapping
- Fallback polling (30s) when WebSocket disconnected
- Entity-to-query-key mapping for ~40+ entities

### 6.7 Component Patterns

**Dual Generic CRUD Systems Exist:**

1. **Legacy (`CrudPage.tsx`, `DataTable.jsx`, `schemas.js`):**

   - LocalStorage-based persistence
   - Client-side pagination/sorting/filtering
   - Schema-driven form generation from `schemas.js`
   - Used in: settings pages, some HR sub-pages
   - `.jsx` files (not TypeScript)
2. **Modern (`DynamicModulePage.tsx`, `DetailLayout.tsx`, `workflow.tsx`):**

   - React Query-backed data fetching
   - Server-side or client-side pagination
   - TypeScript generics for type safety
   - KPI cards, tabbed detail views, charts, sidebar
   - Batch actions with row selection
   - Permission-aware action buttons
   - Used in: finance, inventory, sales main pages

**Reusable Components (src/components/reuseable/):**

- `FormModal` — generic modal wrapper with Escape key, backdrop, loading state
- `SearchableSelect` — searchable dropdown with inline "Add New" support
- `ConfirmationModal` — via context (`useConfirmation()`)
- `PermissionGuard` — route-level access denials
- `PageHeader` — breadcrumbs + title + action buttons
- `DataTable` (.jsx) — sortable, paginated table with badge rendering
- `TableGridView` — table/grid view toggle component
- `StatCard` / `StatsCards` — KPI display cards
- `FilterBar` — search/filter input
- `FileUpload` — drag-and-drop file upload
- `DatePicker` / `DateRangePickerRac` — date selection
- `LocationSelectors` (.jsx) — cascading country/state/city selects
- `EmployeeMultiSelect` — employee search + multi-select
- `DocumentViewer` — inline document preview
- `StepBar` — multi-step progress indicator
- `FormField` — form field wrapper
- `FormSelectWithCreate` — select with inline creation
- `ReasonInputModal` — modal for entering reason/notes
- `InboxIcon` — notification bell icon component
- `Checkbox` — reusable checkbox wrapper
- `CurrencySelect` (.jsx) — currency selector
- `ThemeInitializer` — dark/light theme bootstrap
- `DynamicModulePage` (final/) — generic React Query-backed CRUD with KPI cards, tabs, batch actions
- `DetailLayout` (final/) — tabbed detail view with sidebar
- `workflow` (final/) — workflow step component

### 6.8 Environment Variables (frontend)

| Variable                | Description          |
| ----------------------- | -------------------- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

---

## 7. Authentication Flow

```
User → /login
  │  POST /api/accounts/login/ { username, password }
  ▼
Backend validates via EmailOrUsernameBackend
  │
  ├─ Success: sets HttpOnly cookies (access_token, refresh_token)
  │            returns { user: { id, username, email, role, companyId, branchId } }
  │
  └─ Failure: returns 401 { detail: "..." }

Frontend useAuth().login():
  ├─ On success: dispatch(setUser(data.user))
  │              → navigate(/dashboard)
  │              → AppLayout loads permissions + company settings
  │
  └─ On failure: returns { ok: false, error: "..." }

Subsequent requests:
  ├─ apiFetch() sends credentials: "include"
  │   → CookieJWTAuthentication reads access_token cookie
  │
  └─ On 401:
      ├─ Try POST /api/accounts/token/refresh/ (refresh_token cookie)
      │   ├─ Success: retry original request
      │   └─ Failure: POST /api/accounts/logout/, clear state, redirect /login

Logout:
  ├─ POST /api/accounts/logout/ (swallows error)
  ├─ queryClient.clear()
  ├─ dispatch(resetApp()) → Redux state = undefined
  ├─ Clear localStorage + sessionStorage
  └─ navigate(/login)
```

---

## 8. Request Lifecycle

```
Browser
  │
  ├─ HTTP GET /api/inventory/products/
  │
  ▼
Daphne → ASGI Router (http)
  │
  ▼
Django Middleware Stack (in order):
  1. CorsMiddleware            → CORS headers
  2. SecurityMiddleware        → security checks
  3. SessionMiddleware         → Django sessions
  4. CommonMiddleware          → URL rewriting
  5. CsrfViewMiddleware        → CSRF protection
  6. AuthenticationMiddleware  → attaches request.user
  7. PermissionMiddleware      → attaches has_perm_code, check_permission, require_permission
  8. MessageMiddleware         → Django messages
  9. XFrameOptionsMiddleware   → clickjacking protection
  10. CurrentRequestMiddleware → stores request in thread-local
  │
  ▼
URL Router (/api/inventory/) → App URLs → ViewSet
  │
  ├─ CompanyBranchMixin.get_queryset()
  │   → filter(company_id=user.company_id, is_deleted=False)
  │   → optionally filter by branch_id
  │
  ├─ PermissionRequiredMixin.check_permissions()
  │   → resolve action from HTTP method / viewset action
  │   → check_permission(user, module, resource, action)
  │   → Redis cache hit/miss → DB lookup
  │   → raise PermissionDenied if not authorized
  │
  ├─ GenericFilterMixin
  │   → apply filter_fields, search, ordering
  │
  ├─ StandardPagination
  │   → page-based pagination
  │
  └─ Response → JSONRenderer → JSON response
```

---

## 9. WebSocket Lifecycle

```
Connection:
  Client → ws://host/ws/notifications/{company_id}/{branch_id}/
  │
  ├─ OriginValidator → check Origin header against ALLOWED_HOSTS
  ├─ JWTAuthCookieMiddleware → extract access_token cookie, decode JWT, set scope["user"]
  ├─ URLRouter → match URL pattern
  └─ NotificationConsumer.connect()
      ├─ Validate user authentication
      ├─ Add to group: notify_c{company_id}_b{branch_id}
      └─ Accept connection

Data Update Push (from backend):
  View creates/updates/deletes record
    → manual async_to_sync(channel_layer.group_send)("notify_c{b}_b{id}", {
         "type": "data_update",
         "entity": "inventory_product",
         "action": "created",
         "record_id": "..."
       })
    → OR automatic via notification signals + registry

Client receives:
  → NotificationContext WebSocket onmessage
    → if type === "notification": append to state, show desktop toast
    → if type === "data_update": queryClient.invalidateQueries({ queryKey })
      → React Query refetches fresh data from API

Permission Update:
  Admin changes role/permission
    → Permission signals fire
    → PermissionService.invalidate_user_cache(userId)
    → PermissionConsumer.broadcast_permission_changed(channel_layer, userId)

  Client receives:
    → usePermissionSocket onmessage
    → if self_permission_changed: debounced 300ms, dispatch(loadPermissions())
    → Redux store updated → sidebar re-renders, route guards re-evaluate
```

---

## 10. Redis Interactions

| Purpose           | Redis DB | Key Pattern                                                                                  | Used By                       |
| ----------------- | -------- | -------------------------------------------------------------------------------------------- | ----------------------------- |
| WebSocket Channel | 0        | channels group names                                                                         | Channels layer                |
| Permission Cache  | 1        | `perm_id:{code}`, `user_roles:{id}`, `role_perms:{ids}`, `user_override:{uid}:{pid}` | PermissionService             |
| Code Generation   | (shared) | `code_counter:{prefix}`                                                                    | GenerateCodeView (cache.incr) |
| General Cache     | 1        | django cache keys                                                                            | django-redis                  |
| Celery Broker     | (shared) | celery task keys                                                                             | Celery                        |
| Celery Result     | (shared) | celery result keys                                                                           | Celery (if configured)        |

---

## 11. Coding Standards & Conventions

### Backend (Python/Django)

| Convention                   | Rule                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| **Model naming**       | Singular CamelCase:`ProductVariant`, `SupplierBill`                                        |
| **DB tables**          | `{app}_{model}` lowercase snake_case (e.g., `inventory_products`) or explicit `db_table` |
| **ViewSet naming**     | `{Entity}ViewSet` (e.g., `ProductViewSet`)                                                 |
| **APIView naming**     | `{Entity}View` (e.g., `EmployeeView`)                                                      |
| **URL prefixes**       | Plural kebab-case:`customer-invoices`, `supplier-bills`, `journal-entries`               |
| **Serializer naming**  | `{Entity}Serializer`                                                                         |
| **Service naming**     | `{domain}_service.py` (e.g., `stock_service.py`, `payable.py`)                           |
| **Import order**       | 1. stdlib → 2. django → 3. DRF → 4. local apps (absolute imports)                           |
| **ViewSet attributes** | `permission_module`, `permission_resource`, `lookup_field = '_id'`                       |
| **Response format**    | `{ "success": bool, "message": str, "data": {...} }` for mutations                           |
| **Code generation**    | Always use`GenerateCodeView` (Redis atomic INCR) — never client-side generate               |
| **Transactions**       | `@transaction.atomic` on all mutation views                                                  |
| **Soft delete**        | Never hard-delete; set`is_deleted=True`                                                      |
| **UUID lookups**       | Use`_id` (UUID) in URL patterns, never auto-increment `id`                                 |
| **Tenant isolation**   | Always filter by`company_id` + `branch_id` from `request.user`                           |

### Frontend (TypeScript/React)

| Convention               | Rule                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| **File naming**    | PascalCase for components (`ProductForm.tsx`), camelCase for hooks/utils (`useProducts.ts`)    |
| **Components**     | Default exports for page components, named exports for reusable                                    |
| **Hooks**          | Prefix`use*` (e.g., `useProducts`, `useAuth`)                                                |
| **Hooks location** | Domain-specific in`hooks/{domain}/`, general in `hooks/`                                       |
| **Store slices**   | `{name}Slice.ts` in `store/slices/`                                                            |
| **Config files**   | `.js` for config-only files without types (menu.js, schemas.js)                                  |
| **API calls**      | Always through hooks →`apiFetch` — never direct `fetch`                                      |
| **Permissions**    | Always dynamic via`useFeaturePermissions()` or Redux state — never hardcoded `true`/`false` |
| **State**          | Redux for client state (auth, permissions, theme, settings), React Query for server state          |
| **Forms**          | Use React Hook Form + Zod for new forms; legacy schemas.js for older pages                         |
| **Toasts**         | Do NOT duplicate`toast.success/error` for API calls — `apiFetch` auto-shows them              |
| **Type safety**    | Prefer TypeScript;`.tsx` for new components, `.jsx` legacy files are acceptable                |
| **CSS**            | Tailwind utility classes +`cn()` from `@/lib/utils`                                            |

---

## 12. Data Flows & Key Workflows

### 12.1 Product Creation Flow

```
Frontend: ProductForm.tsx
  → POST /api/inventory/products/ { productName, variants: [{sku, sellingPrice, attributes, images}] }
Backend: ProductViewSet.create()
  → Transaction atomic
  → Create Product record
  → Find/create default Warehouse
  → For each variant:
      Create ProductVariant
      Create VariantAttributes
      Create VariantImages
      Create StockItem (quantity_on_hand=0)
  → Return product with nested variants

Frontend:
  → useProducts().refetch()
  → NotificationContext receives data_update → invalidates inventory_product query
```

### 12.2 Lead Conversion Flow

```
Frontend: LeadsPanel.tsx
  → POST /api/sales/leads/{id}/convert_to_customer/
Backend: LeadViewSet.convert_to_customer()
  → Validate status == 'QUALIFIED'
  → Transaction atomic
  → Create Customer record (inventory app)
  → Set lead.converted_customer = customer
  → Set lead.status = 'CONVERTED'
  → Return { customer_id }

Frontend:
  → invalidate queries: ["sales_leads"], ["sales_customers"]
```

### 12.3 Leave Application Flow

```
Frontend: LeaveFormModal.tsx
  → POST /api/hr/leaves/ { employee_id, leave_type, start_date, end_date, reason }
Backend: LeaveView.post()
  → Validate required fields
  → Validate employee joined before start_date
  → Create LeaveRequest (status=PENDING)
  → Return success

Frontend:
  → invalidate queries: ["leaves", "leaveStats", "leaveBalances"]
  → toast success from apiFetch
```

### 12.4 Payment Recording Flow

```
Frontend: PaymentFormModal.tsx (finance/payments)
  → POST /api/finance/payments/ { payment_type, amount, payable_id, payable_type, ... }
Backend: PaymentViewSet.create()
  → Use GenericForeignKey to link payable (CustomerInvoice, SupplierBill, PayrollRecord, Expense)
  → PayableModelMixin provides payable integration for models like PayrollRecord
  → Update payable payment status
  → Create/update JournalEntry with debit/credit lines
  → Return payment with journal reference
```

---

## 13. AI Contributor Rules

### Where to Add New Components

| Component Type            | Location                                      | Convention                                                    |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| Page component            | `src/app/(app)/<module>/<feature>/page.tsx` | Default export                                                |
| Reusable UI component     | `src/components/ui/<name>.tsx`              | shadcn/ui style, named export                                 |
| Domain-specific component | `src/components/<module>/<name>.tsx`        | e.g.,`src/components/finance/accounts/AccountFormModal.tsx` |
| Cross-module reusable     | `src/components/reuseable/<name>.tsx`       | e.g.,`SearchableSelect.tsx`                                 |
| New generic layout        | `src/components/reuseable/final/<name>.tsx` | For DynamicModulePage-like generic components                 |

### Where to Add New Hooks

| Hook Type          | Location                                                     | Naming                                |
| ------------------ | ------------------------------------------------------------ | ------------------------------------- |
| Domain data hook   | `src/hooks/<domain>/use<Entity>.ts`                        | e.g.,`useProducts`, `useAccounts` |
| Cross-cutting hook | `src/hooks/use<Feature>.ts`                                | e.g.,`useAuth`, `usePermissions`  |
| API wrapper        | `src/lib/api.ts` (base), `src/hooks/useApi.ts` (wrapper) |                                       |

### Where to Add New APIs

1. Create ViewSet/APIView in the appropriate `backend/apps/<app>/views/` directory
2. Register in `backend/apps/<app>/urls.py` using DRF router
3. Include in root `backend/config/urls.py` under the `/api/<app>/` prefix
4. Add TypeScript types in `frontend/src/types/` if needed
5. Create React Query hook in `frontend/src/hooks/<domain>/`
6. Add route permission in `frontend/src/config/routePermissions.ts`
7. Add menu entry in `frontend/src/config/menu.js`
8. Add entity-to-query-key mapping in `frontend/src/contexts/NotificationContext.tsx` for cache invalidation

### Backend Module Creation Rules

1. Create app under `backend/apps/` (NOT in project root)
2. Add to `INSTALLED_APPS` in `backend/config/settings.py`
3. Register API routes in `backend/config/urls.py`
4. Add Module/Resource/Action entries in `seed_permissions.py`
5. Models should inherit `BaseModel` from `apps.common.basemodel` (unless a good reason not to)
6. Models needing finance/payment integration should also inherit `PayableModelMixin` from `apps.finance.services.payable`
7. ViewSets should inherit from `CompanyBranchMixin` + `PermissionRequiredMixin`
8. Use `lookup_field = '_id'` for UUID-based lookups
9. Override `create`/`update`/`destroy` to return `{ success, message, data }` format

### Naming Conventions

- **Backend:** `snake_case` for Python files, `PascalCase` for classes
- **Frontend:** `PascalCase.tsx` for components, `camelCase.ts` for hooks/utils
- **API endpoints:** kebab-case: `/api/inventory/customer-invoices/`
- **Permission codes:** `MODULE:resource:action` (uppercase module, lowercase resource/action)
- **Database tables:** `{app}_{model}` in snake_case
- **Git branches:** `feature/description`, `fix/description`

### Type Safety Requirements

- New code should be TypeScript (`.tsx`/`.ts`)
- Use TypeScript generics for reusable components (`DynamicModulePage<T>`)
- Define permission action types as `Record<string, boolean>` in hooks
- React Query hooks should define return types via generics
- API responses should be typed where consumed

### Database Migration Rules

- **NEVER** run `makemigrations` or `migrate` via AI tools (use Django management commands manually)
- Use `BigAutoField` for primary keys (Django 5+ default)
- Use `_id` UUIDField for API-facing identifiers
- Add indexes for frequently filtered columns (status, is_active, dates)
- Add `unique_together` constraints for business-unique combinations + tenant columns
- Use `db_index=True` on company_id/branch_id
- Use `CONN_MAX_AGE=60` and `ATOMIC_REQUESTS=True` (already configured)

### Testing Expectations

- Backend tests use `BaseTestCase` from `apps.common.test_base`
- Tests should use `APIClient` with pre-authenticated admin user
- `UnauthenticatedTestCase` for permission-denied tests
- Tests for new endpoints should verify: success case, permission denial, multi-tenant isolation, validation errors
- Frontend tests: not yet established (no test framework in package.json)

### Seeding Rules

- Production seeds: use `seed_org` + `seed_permissions` management commands
- Bulk test data: use `python manage.py seed_data --count N` from `apps/common/management/commands/seed_data.py`
- New permission resources: add to `RESOURCES_ACTIONS` in `seed_permissions.py`
- New module codes: if needed for broadcasting, add ENTITY_TO_QUERY_KEY in NotificationContext.tsx

---

## 14. Known Issues & Technical Debt

| Issue                          | Location                                                                              | Description                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Dual CRUD systems              | `CrudPage.tsx` vs `DynamicModulePage.tsx`                                         | Legacy localStorage-based CRUD coexists with modern React Query-based CRUD. New features should use`DynamicModulePage`.       |
| Mixed file formats             | Various`.jsx` files                                                                 | `DataTable.jsx`, `LocationSelectors.jsx`, `CurrencySelect.jsx`, `EmployeeForm.jsx` — migrating to `.tsx` is ongoing. |
| Forgot password leak           | `frontend/src/app/login/page.tsx`                                                   | Returns hardcoded`"password is admin123"` — security risk.                                                                   |
| Plaintext passwords            | `backend/.env`                                                                      | `ORG_ADMIN_PASSWORD=123456` — development-only but risky.                                                                    |
| Celery not in entrypoint       | `backend/entrypoint.sh`                                                             | Only starts daphne. Celery worker and beat require separate containers or manual startup.                                       |
| Commented-out routes           | `backend/apps/finance/urls.py`                                                      | `bank-transactions`, `vendor` routes commented out.                                                                         |
| `test_runner.py` unused      | `backend/config/test_runner.py`                                                     | Exists but not referenced in`settings.py`.                                                                                    |
| `test_settings.py` unused    | `backend/config/test_settings.py`                                                   | Exists but not used.                                                                                                            |
| Duplicate route                | `frontend/src/app/(app)/finance/forecast/page.tsx` and `.../forecasting/page.tsx` | Two separate forecast routes — likely one is dead.                                                                             |
| Chart of Accounts merged into seed_org | `backend/apps/organization/management/commands/seed_org.py`                        | Chart of accounts (11 standard accounts) is now seeded inside `seed_org` at lines 166-203, not as a separate command. Update any references from `seed_chart_of_accounts`. |
| Missing TypeScript strictness  | `frontend/tsconfig.json`                                                            | `noImplicitAny: false`, `noUnusedLocals: false` — loose for rapid development.                                             |
| Weak ESLint rules              | `frontend/eslint.config.js`                                                         | `no-unused-vars: off`, `no-explicit-any: off` — should tighten for production.                                             |
| `finance-design` missing     | `frontend/src/components/finance/ui.tsx`                                            | Imported by`DynamicModulePage`/`DetailLayout` but file exports are not fully verified.                                      |
| Inventory audit dual system    | `backend/apps/inventory/audit.py` + `backend/apps/audit/`                         | Two parallel audit engines — inventory uses ThreadPoolExecutor, audit app uses signals.                                        |
| DASHBOARD module missing       | `backend/apps/overall_dashboard/views.py`                                          | `OverallDashboardViewSet` uses `permission_module = 'DASHBOARD'` but `seed_permissions.py` does not define a DASHBOARD module. Works via `action_permission_any_of` fallbacks (FINANCE, INVENTORY, SALES), but should be registered. |

---

## 15. Docker & Deployment

### Docker Compose Services

| Service      | Image             | Ports                  | Depends On |
| ------------ | ----------------- | ---------------------- | ---------- |
| `db`       | postgres:15       | ${APP_HOST}:5433:5432  | —         |
| `redis`    | redis:7           | 6379:6379              | —         |
| `backend`  | alqaiser-backend  | ${APP_HOST}:8000:8000  | db, redis  |
| `frontend` | alqaiser-frontend | ${APP_HOST}:3000:3000  | backend    |

**Note:** Ports are bound to `APP_HOST` (e.g. `192.168.88.51`) from `.env`. Frontend's `NEXT_PUBLIC_API_URL` is set to `http://${APP_HOST}:8000`.

### Startup Order (Entrypoint.sh)

1. Wait for PostgreSQL (`pg_isready`)
2. `python manage.py collectstatic --noinput`
3. `daphne -b 0.0.0.0 -p 8000 config.asgi:application`

### Seed Commands (run in order after first deploy)

```bash
python manage.py seed_org                  # Company + admin user + default warehouse + company settings + working days + chart of accounts (11 standard accounts)
python manage.py seed_permissions          # RBAC matrix (7 modules, 3 roles)
python manage.py seed_data --count N       # (optional) Bulk test data via faker
```

### Other Management Commands

```bash
python manage.py seed_data --count N       # Bulk test data (all modules)
python manage.py seed_data --clear         # Wipe seeded data
python manage.py seed_permissions          # Idempotent permission seeding
python manage.py seed_org                  # Organization seeding
```
