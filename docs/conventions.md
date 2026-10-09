# Conventions — Al Qaiser Nexus ERP

Short coding and process rules. Full tables live in [`../agent.md`](../agent.md) § Coding Standards.

---

## Backend

| Topic | Rule |
| ----- | ---- |
| Models | Prefer `BaseModel`; soft-delete only |
| Lookups | UUID `_id` in APIs, never expose relying on integer PK in URLs |
| Tenancy | Always scope by `company_id` / `branch_id` via mixin |
| Permissions | Set `permission_module` + `permission_resource` on views |
| Mutations | `@transaction.atomic` where multi-row integrity matters |
| Responses | `{ success, message, data }` for mutations |
| Codes | Server-side Redis `GenerateCodeView` — never client invent |
| Files | `snake_case.py`, `PascalCase` classes |
| Apps | Live under `backend/apps/` only |

---

## Frontend

| Topic | Rule |
| ----- | ---- |
| New UI | TypeScript `.tsx`; prefer `DynamicModulePage` over `CrudPage` |
| Data | Hooks → `apiFetch`; no raw `fetch` in pages |
| State | Redux = auth/theme/permissions/settings; React Query = server data |
| Toasts | Do not duplicate — `apiFetch` already toasts mutations |
| Permissions | Never hardcode access; use Redux / guards |
| Naming | `PascalCase.tsx` components, `use*.ts` hooks |
| Styles | Tailwind + `cn()` |

---

## Permissions

- Format: `MODULE:resource:action`  
- Modules include: `HR`, `INVENTORY`, `FINANCE`, `SALES`, `AI_MONITORING`, `SETTINGS`, `NOTIFICATIONS`  
- New resource → update `seed_permissions.py` + frontend route/menu maps  

---

## Git

| Item | Convention |
| ---- | ---------- |
| Feature | `feature/<desc>` |
| Fix | `fix/<desc>` |
| Commits | Imperative, why-focused; update CHANGELOG for user-visible work |
| Bugs | Log in `docs/bugfoundresolved.md` |
| Secrets | Never commit `.env` |

---

## Documentation ownership

| Change type | Update |
| ----------- | ------ |
| Architecture / stack | `docs/architecture.md`, maybe `agent.md` |
| New folder/app/route | `docs/filestructure.md`, `agent.md` tree |
| Process / how-to-run | `docs/workflow.md`, `docs/setup.md` |
| Bug fix | `docs/bugfoundresolved.md`, `CHANGELOG.md` |
| AI behavior | `prompt.md`, relevant `agent.md` sections |
| End-user steps | `documentation.txt` |

---

## Related

- [`../prompt.md`](../prompt.md)  
- [`../agent.md`](../agent.md)  
