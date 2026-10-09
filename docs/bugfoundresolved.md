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
