# File Structure — Al Qaiser Nexus ERP

> Repository map for `nexuscrm`. Prefer this for navigation; see [`../agent.md`](../agent.md) for behavioral detail.

---

## 1. Repository Root

```
nexuscrm/
├── agent.md                 # Full technical source of truth for AI/humans
├── prompt.md                # Condensed AI system prompt
├── CHANGELOG.md             # Versioned release notes
├── documentation.txt        # End-user product guide
├── opencode.json            # Editor/LSP helper config
├── .gitignore
├── docs/                    # Professional project docs (this folder)
│   ├── README.md
│   ├── architecture.md
│   ├── workflow.md
│   ├── filestructure.md
│   ├── bugfoundresolved.md
│   ├── setup.md
│   └── conventions.md
├── backend/                 # Django project
└── frontend/                # Next.js project
```

**Removed from repo:** Docker / docker-compose (run services locally).

---

## 2. Backend

```
backend/
├── manage.py
├── requirements.txt
├── cmd                      # Local command cheat-sheet (comments)
├── celerybeat-schedule      # Celery beat persistence (local)
├── .env                     # Secrets (not committed)
├── config/
│   ├── settings.py          # Apps, middleware, DRF, JWT, Redis, CORS
│   ├── urls.py              # /api/* router + /health/
│   ├── asgi.py              # HTTP + WebSocket
│   ├── wsgi.py
│   ├── celery.py            # Celery app + beat schedule
│   ├── test_runner.py
│   └── test_settings.py
├── consumers/
│   └── permission_consumer.py
├── apps/
│   ├── accounts/            # login, logout, refresh, me
│   ├── audit/               # global audit signals/API
│   ├── common/              # BaseModel, auth, pagination, filters, upload, seed_data
│   ├── compsetting/         # company settings, holidays, designations, terms
│   │   └── trash/           # Settings → Trash: registry, services, views, tasks
│   ├── organization/        # Company, Branch, User (+ seed_org)
│   ├── permissions/         # RBAC engine + seed_permissions
│   ├── hr/                  # employees, leave, payroll, shifts, assets, ...
│   ├── inventory/           # products, stock, PO/SO, POS, alerts, import/export
│   ├── finance/             # CoA, journals, invoices, payments, budgets, reports
│   ├── sales/               # leads, quotes, invoices
│   ├── forecast/            # analytics, services, Celery tasks
│   ├── monitoring/          # sites, NVRs, cameras, streams
│   ├── notifications/       # WS consumers, registry, broadcast helpers
│   └── overall_dashboard/   # cross-module KPIs
├── upload/                  # user media (runtime)
└── face_model/              # monitoring-related model assets (if present)
```

### Typical app internals

Larger apps use packages:

```
apps/<app>/
├── models/ or models.py
├── serializers/
├── views/
├── services/
├── urls.py
├── signals*.py
├── admin.py
└── migrations/
```

Approx. Python file counts (order of magnitude): inventory ~84, finance ~65, hr ~51, sales ~33, permissions ~19, monitoring ~11.

---

## 3. Frontend

```
frontend/
├── package.json             # scripts: dev, build, start, lint
├── next.config.mjs
├── tsconfig.json            # @/* → ./src/*
├── components.json          # shadcn (new-york)
├── eslint.config.js
├── postcss.config.mjs
├── bunfig.toml / bun.lockb
├── public/
├── .env                     # NEXT_PUBLIC_API_URL
└── src/
    ├── app/
    │   ├── layout.tsx       # root providers
    │   ├── providers.tsx
    │   ├── login/
    │   ├── unauthorized/
    │   ├── demo/
    │   └── (app)/           # authenticated shell
    │       ├── layout.tsx
    │       ├── dashboard/
    │       ├── hr/
    │       ├── inventory/
    │       ├── finance/
    │       ├── sales/
    │       │   ├── quotes/                 # Quote list, create/edit pages, and quote detail
    │       │   └── customer-invoices/      # Invoice list, create/edit pages, and invoice detail
    │       ├── monitoring/
    │       └── settings/
    │           └── trash/       # deleted-records page (permanent delete / restore)
    ├── components/
    │   ├── ui/              # shadcn primitives
    │   ├── reuseable/       # shared widgets + final/ generics
    │   ├── sidebar/
    │   ├── navbar/
    │   ├── documents/                      # Shared quote/invoice create/edit form and workflows
    │   ├── invoice-generator/              # Shared CRM document preview, template, and print UI (not a public route)
    │   └── {hr,inventory,finance,sales,monitoring,settings,...}/
    ├── hooks/
    │   ├── finance/
    │   ├── sales/
    │   ├── overall/
    │   └── use*.ts          # cross-cutting hooks
    ├── config/
    │   ├── menu.js
    │   ├── routePermissions.ts
    │   ├── schemas.js       # legacy form schemas
    │   └── monitoringFeeds.js
    ├── contexts/
    │   ├── NotificationContext.tsx
    │   └── ConfirmationModalContext.tsx
    ├── store/
    │   ├── index.ts
    │   ├── reset.ts
    │   └── slices/
    ├── lib/
    │   ├── api.ts
    │   ├── permissions.ts
    │   ├── notifications.ts
    │   └── utils.ts
    ├── layouts/
    │   └── AppLayout.tsx
    ├── services/
    │   └── localStorageService.ts
    ├── types/
    └── seed/
```

### Route groups (App Router)

| Path prefix | Module |
| ----------- | ------ |
| `/dashboard` | Unified dashboard |
| `/hr/*` | HR |
| `/inventory/*` | Inventory (+ POS under `/inventory/pos`) |
| `/finance/*` | Finance |
| `/sales/*` | Sales |
| `/monitoring/*` | AI Monitoring |
| `/settings/*` | Settings |
| `/login`, `/unauthorized` | Public |

---

## 4. Where to put new code

| You are adding… | Put it here |
| --------------- | ----------- |
| Django domain model/API | `backend/apps/<existing-app>/` |
| Brand-new Django domain | `backend/apps/<new>/` + `INSTALLED_APPS` + `urls.py` |
| Shared backend util | `backend/apps/common/` |
| Page route | `frontend/src/app/(app)/<module>/.../page.tsx` |
| Domain UI | `frontend/src/components/<module>/` |
| Reusable UI | `frontend/src/components/reuseable/` or `ui/` |
| Data hook | `frontend/src/hooks/<domain>/` |
| Permission route map | `frontend/src/config/routePermissions.ts` |
| Sidebar entry | `frontend/src/config/menu.js` |
| Project process docs | `docs/` |
| Release notes | `CHANGELOG.md` |
| Bug log entry | `docs/bugfoundresolved.md` |

---

## 5. Files to never commit

- `backend/.env`, `frontend/.env`, root `.env` if present  
- `backend/venv/`, `frontend/node_modules/`, `.next/`  
- Uploaded media under `backend/upload/` (unless intentionally tracked)  
- Local Celery schedule artifacts if environment-specific  

---

## 6. Related docs

- [architecture.md](./architecture.md)  
- [workflow.md](./workflow.md)  
- [conventions.md](./conventions.md)  
