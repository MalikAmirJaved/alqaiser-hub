# Workflows — Al Qaiser Nexus ERP

> Operational and business flows for developers and AI agents.  
> Command cheat-sheet: `backend/cmd`

---

## 1. Local Development Workflow

```
1. Start PostgreSQL + Redis (local installs or existing services)
2. Backend venv → migrate → seed (first time) → Daphne
3. (Optional) Celery worker + beat for forecasts
4. Frontend → npm/bun install → next dev
5. Open frontend URL → login → change default admin password
```

### Typical daily loop

| Step | Action |
| ---- | ------ |
| 1 | Pull latest branch |
| 2 | Activate `backend/venv`, ensure Redis/Postgres up |
| 3 | `python manage.py migrate` if models changed |
| 4 | Start Daphne: `daphne -b 0.0.0.0 -p 8000 config.asgi:application` |
| 5 | Start frontend: `npm run dev` (or bun) in `frontend/` |
| 6 | For forecast work: start Celery worker + beat |
| 7 | Implement → test in UI/API → update docs/changelog if needed |

### First-time seed order

```bash
python manage.py seed_org          # company, admin, warehouse, CoA, settings
python manage.py seed_permissions  # RBAC matrix
# optional:
python manage.py seed_data --count N
```

See [setup.md](./setup.md) for env vars and ports.

---

## 2. Git / Delivery Workflow

```
feature/* or fix/* branch
  → implement + self-test
  → update CHANGELOG / docs/bugfoundresolved.md when fixing bugs
  → PR into integration branch
  → review → merge
```

Branch naming (project convention):

- `feature/<short-description>`
- `fix/<short-description>`
- `resolve/<topic>-<date>` (e.g. bug-resolution batches)

**Do not** run `makemigrations` / `migrate` via AI automation unless explicitly asked; prefer local Django commands.

---

## 3. Authentication Workflow

```
POST /api/accounts/login/  { username|email, password }
  ├─ success → Set-Cookie access_token + refresh_token (HttpOnly)
  │            body: { user: { id, username, email, role, companyId, branchId } }
  └─ failure → 401

AppLayout:
  ├─ loadPermissions()  → /api/permissions/me/ + modules
  └─ loadCompanySettings()

apiFetch on 401:
  ├─ POST /api/accounts/token/refresh/
  │   ├─ ok → retry original request
  │   └─ fail → logout, clear state, redirect /login
  └─ Logout: POST /api/accounts/logout/ + Redux reset + clear storage
```

---

## 4. HTTP Request Lifecycle

```
Browser apiFetch (credentials: include)
  → Daphne ASGI (HTTP)
  → Middleware: CORS → Security → Session → Common → CSRF
               → Auth → Permission helpers → Messages → XFrame
               → CurrentRequestMiddleware
  → /api/<app>/... ViewSet or APIView
  → CompanyBranchMixin (tenant + soft-delete filter)
  → PermissionRequiredMixin (MODULE:resource:action)
  → Filters / search / pagination
  → Serializer → JSON response
```

**Mutation response shape:**

```json
{ "success": true, "message": "...", "data": { } }
```

**List (paginated):**

```json
{ "count": N, "total_pages": N, "current_page": N, "next": null, "previous": null, "results": [] }
```

---

## 5. WebSocket Workflow

### Notifications

```
Client connects:
  ws://<api>/ws/notifications/<company_id>/<branch_id>/
  → JWT cookie middleware → NotificationConsumer
  → join notify_c{company}_b{branch}

Server event:
  create/update/delete (manual broadcast or registry signal)
  → group_send type=notification | data_update

Client:
  notification → UI + desktop toast
  data_update  → queryClient.invalidateQueries(entity key)
```

### Permissions

```
Admin changes role / override
  → permission signals → cache invalidate
  → PermissionConsumer broadcast
  → client usePermissionSocket → reload permissions (debounced)
  → sidebar + route guards update
```

---

## 6. Feature Development Workflow

### Backend (new CRUD resource)

1. Model in `apps/<app>/` inheriting `BaseModel` (unless exception).
2. Serializer + ViewSet/APIView with `CompanyBranchMixin` + `PermissionRequiredMixin`.
3. Register router in app `urls.py`; confirm root include in `config/urls.py`.
4. Add permission resource/actions in `seed_permissions.py`; re-seed.
5. Soft-delete on destroy; UUID `lookup_field = '_id'`.

### Frontend (new page)

1. Page under `src/app/(app)/<module>/<feature>/page.tsx`.
2. Hook in `src/hooks/<domain>/` using `apiFetch`.
3. Prefer `DynamicModulePage` / domain components over legacy `CrudPage`.
4. Add `routePermissions.ts` + `menu.js` entries.
5. Map entity → query key in `NotificationContext` if realtime invalidation needed.

---

## 7. Key Business Workflows

### 7.1 Product create (Inventory)

```
ProductForm → POST /api/inventory/products/
  → atomic: Product + variants + attributes + images + StockItem(0)
  → WS data_update → invalidate product queries
```

### 7.2 Lead → Customer (Sales)

```
Lead status QUALIFIED → convert_to_customer
  → create Inventory Customer
  → lead.status = CONVERTED
  → invalidate sales_leads + sales_customers
```

### 7.3 Leave request (HR)

```
Leave form → POST /api/hr/leaves/
  → LeaveRequest PENDING
  → approval actions update status
  → invalidate leaves / balances / stats
```

### 7.4 Payment (Finance)

```
PaymentForm → POST /api/finance/payments/
  → GenericForeignKey to payable (invoice, bill, payroll, expense)
  → update payable status + journal lines
```

### 7.5 POS → Invoice

```
POS checkout → sales order / stock movement
  → attach finance invoice / accounting updates
```

### 7.6 Product import (Bulk)

```
Upload XLSX/CSV → parse endpoint → review rows → confirm import
  → brands/categories auto-create, SKU fill, stock in default warehouse
  → source field marks import origin
```

### 7.7 Forecast (Celery)

```
Beat 02:00 UTC → generate sales forecasts (all companies)
Beat 03:00 UTC → generate stock forecasts (all companies)
  → DemandForecaster / StockForecaster services
```

---

## 8. Release / Changelog Workflow

1. Group user-visible changes under a version in `CHANGELOG.md`.
2. Record bug fixes in [bugfoundresolved.md](./bugfoundresolved.md) with root cause.
3. Sync high-level notes into `agent.md` Known Issues if debt remains.
4. Keep end-user steps in `documentation.txt` when UX changes.

---

## 9. Related docs

- [architecture.md](./architecture.md)  
- [filestructure.md](./filestructure.md)  
- [setup.md](./setup.md)  
- [`../prompt.md`](../prompt.md)  
