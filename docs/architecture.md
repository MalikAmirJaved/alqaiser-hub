# Architecture — Al Qaiser Nexus ERP

> Last aligned with codebase: 2026-10-09  
> Deep reference: [`../agent.md`](../agent.md)

---

## 1. Purpose

**Nexus ERP / Al-Qaiser BOS** is a multi-tenant Business Operating System covering:

- HR, Inventory, Sales, Finance  
- AI Monitoring (CCTV / HLS)  
- Settings, Permissions (RBAC), Notifications, Forecasting, Audit  

All business data is isolated by **company** and **branch**.

---

## 2. High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Browser — Next.js 16 (App Router) + React 19 + TypeScript  │
│  Redux Toolkit (auth/theme/permissions) + TanStack Query    │
└───────────────────────────┬─────────────────────────────────┘
                            │  REST (HttpOnly JWT cookies)
                            │  WebSocket (notifications + permissions)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Daphne (ASGI) — port 8000                                  │
│  ├── HTTP  → Django 6 + DRF (JSON APIs under /api/*)        │
│  └── WS    → Channels (NotificationConsumer, PermissionConsumer) │
└───────────┬───────────────┬───────────────┬─────────────────┘
            │               │               │
            ▼               ▼               ▼
      PostgreSQL       Redis DB 0       Redis DB 1
      (primary DB)     (Channels)       (cache, perms, codes)
                              │
                              ▼
                    Celery worker + beat
                    (sales/stock forecasts)
```

---

## 3. Technology Stack

| Layer | Choice |
| ----- | ------ |
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Client state | Redux Toolkit |
| Server state | TanStack React Query v5 |
| Forms | React Hook Form + Zod (new); legacy `schemas.js` |
| Backend | Python 3.12, Django 6.0, DRF, Channels, Daphne |
| Auth | Cookie JWT (`simplejwt`) + `CookieJWTAuthentication` |
| Database | PostgreSQL |
| Cache / WS / Celery | Redis |
| Analytics / import | pandas, numpy, openpyxl |
| Video | ffmpeg + HLS.js (monitoring) |

**Deployment note:** Docker compose was removed from this repo. Run services locally (see [setup.md](./setup.md)).

---

## 4. Backend Layers

| Layer | Location | Responsibility |
| ----- | -------- | -------------- |
| Config | `backend/config/` | settings, URLs, ASGI/WSGI, Celery |
| Domain apps | `backend/apps/*` | models, serializers, views, services, signals |
| Shared foundation | `backend/apps/common/` | BaseModel, auth, pagination, filters, uploads |
| RBAC | `backend/apps/permissions/` | Module → Resource → Action → Permission |
| Realtime | `apps/notifications/`, `consumers/` | WS broadcast + permission sync |
| Jobs | `apps/forecast/tasks.py` | Daily sales/stock forecasts |

### API surface (`config/urls.py`)

| Prefix | App |
| ------ | --- |
| `/api/accounts/` | Auth |
| `/api/hr/` | HR |
| `/api/inventory/` | Inventory |
| `/api/finance/` | Finance |
| `/api/sales/` | Sales |
| `/api/organization/` | Company / branch / users |
| `/api/company/` | Company settings |
| `/api/permissions/` | RBAC |
| `/api/notifications/` | Notifications |
| `/api/forecast/` | Forecasting |
| `/api/overall/` | Unified dashboard |
| `/api/audit/` | Global audit |
| `/api/common/` | Codes, uploads, helpers |
| `/api/monitoring/` | AI monitoring |
| `/health/` | Health check |

---

## 5. Frontend Layers

| Layer | Location | Responsibility |
| ----- | -------- | -------------- |
| Routes | `frontend/src/app/` | App Router pages (auth + `(app)` shell) |
| Layout shell | `layouts/AppLayout.tsx` | Auth gate, sidebar, topbar, route permissions |
| UI | `components/ui/` | shadcn primitives |
| Domain UI | `components/{module}/` | Feature forms, panels, modals |
| Generics | `components/reuseable/final/` | `DynamicModulePage`, `DetailLayout` |
| Hooks | `hooks/` | React Query + domain logic |
| API | `lib/api.ts` | Cookie auth, refresh, toasts |
| Store | `store/` | Redux slices |
| Config | `config/` | menu, route permissions, schemas |

### Sales quote and invoice documents

The authenticated Sales quote and customer-invoice pages use the shared `components/documents/DocumentForm` entry point. It selects a quote- or invoice-specific workflow for API mutations, validation, and conversion defaults, while common document components handle the template/typography controls and live preview. Saved appearance is represented by the document's `template_slug`, `accent_color`, and `typography`.

The CRM preview builder maps document data and company/customer branding into the shared `InvoiceData` model. The same `InvoicePreview` renderer is used by the editor and CRM print/PDF flow so saved appearance, totals, logo, and terms do not diverge. The editor is an authenticated page workflow; there is no public invoice-generator route or create/edit modal.

### Provider stack

```
ReactQueryProvider
  └─ Redux Provider
       └─ QueryClientProvider
            └─ ThemeInitializer
                 └─ ConfirmationProvider
                      └─ NotificationProvider
                           └─ pages + Toaster
```

---

## 6. Cross-Cutting Concerns

### Multi-tenancy

- Most models inherit `BaseModel` (`company_id`, `branch_id`, soft-delete).
- `CompanyBranchMixin` scopes querysets to the user’s company (and branch unless `COMPANY_ADMIN`).
- API lookups use UUID `_id`, not integer PK.

### Permissions (RBAC)

- Codes: `MODULE:resource:action` (e.g. `INVENTORY:product:view`).
- Resolution: superuser → user override → role permissions → Redis cache (TTL ~5 min).
- Frontend: Redux permissions + `routePermissions.ts` + `PermissionGuard` + WS sync.

### Soft delete

- Prefer `is_deleted=True`; list querysets exclude deleted rows.
- Cascades (e.g. product → variants) implemented in view logic.

### Realtime

- Notifications: company/branch/personal WS rooms + `data_update` for React Query invalidation.
- Permissions: `PermissionConsumer` pushes role/permission changes.

### Audit

- Global signal-based audit (`apps/audit`).
- Inventory field-level audit (`apps/inventory/audit.py`) — parallel engine (known debt).

---

## 7. Data Domain Map

```
Organization ──► Company / Branch / User / Department
Settings     ──► Company profile, terms, designations, preferences
HR           ──► Employees, leave, payroll, shifts, assets, recruitment, exit, policies
Inventory    ──► Products, stock, warehouses, PO/SO, transfers, POS, alerts
Sales        ──► Leads → Quotes → Customers / Invoices
Finance      ──► CoA, journals, invoices, bills, payments, expenses, budgets, reports
Forecast     ──► Sales + stock projections (Celery)
Monitoring   ──► Sites → NVRs → Cameras (HLS)
```

Cross-module links (examples):

- Lead convert → Inventory `Customer`
- POS sale → Finance invoice / accounting
- Payroll → Finance payable / payments
- Purchase / sales orders → stock + finance documents

---

## 8. Security Architecture

| Control | Implementation |
| ------- | -------------- |
| Auth | HttpOnly `access_token` / `refresh_token` cookies |
| API auth | `CookieJWTAuthentication` (+ Bearer fallback) |
| CORS / CSRF | django-cors-headers + Django CSRF middleware |
| Authorization | `PermissionRequiredMixin` on ViewSets/APIViews |
| Tenancy | Mandatory company (and usually branch) filters |
| Secrets | `backend/.env` / `frontend/.env` — never commit |

**Known risk:** default seed admin password and any hardcoded login hints must be changed in production (see [bugfoundresolved.md](./bugfoundresolved.md) / agent known issues).

---

## 9. Related docs

- [workflow.md](./workflow.md) — request and business flows  
- [filestructure.md](./filestructure.md) — folder map  
- [setup.md](./setup.md) — run locally  
- [`../agent.md`](../agent.md) — full patterns, env vars, conventions  
