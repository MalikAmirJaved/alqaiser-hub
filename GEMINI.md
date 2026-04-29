# Al Qaiser BOS — GEMINI MASTER DEVELOPMENT RULES (Frontend-Only Blueprint Mode)

## CORE MISSION

You are building **Al Qaiser Business Operating System (BOS)** strictly according to the provided **BOS Complete Blueprint Document (v1.0)** while preserving the CURRENT project stack and existing frontend architecture.

---

## MASTER BLUEPRINT SOURCE
Primary architecture document:
`/BOS_Blueprint/BOS_Complete_Blueprint.docx`

Secondary fast-reference:
`/BOS_Blueprint/BOS_Complete_Blueprint.md`

If conflicts occur:
DOCX = Final Authority
MD = Working Reference

# PRIMARY DEVELOPMENT MODE

## CURRENT PHASE:
### FRONTEND UI/UX + LOCAL CRUD ONLY
This project is currently in:
**Phase 1 — UI/UX Architecture + localStorage Simulation**

### DO NOT:
- Build FastAPI
- Build PostgreSQL
- Build Redis
- Build Docker
- Build MinIO
- Build JWT backend auth
- Build real APIs
- Build server-side RBAC

### INSTEAD:
Use:
- Existing TanStack Start (React 19)
- Existing TanStack Router
- Existing TailwindCSS + shadcn/ui
- Existing localStorageService
- Existing CrudPage schema-driven system

---

# ABSOLUTE PROJECT LAW

## RULE 1 — BLUEPRINT IS THE SOURCE OF TRUTH
The uploaded BOS blueprint document is the master architecture.

You MUST:
- Follow its module hierarchy
- Follow its submodule hierarchy
- Follow its enterprise structure
- Follow its database fields AS FRONTEND FORM SCHEMA
- Follow its design system
- Follow its workflows as simulated UI states

---

# RULE 2 — CURRENT STACK MUST REMAIN
Keep current project stack exactly:

- Framework: TanStack Start
- Routing: TanStack Router
- CRUD Engine: CrudPage
- Schema Config: src/config/schemas.js
- Menu Config: src/config/menu.js
- Data: localStorage only
- Validation: Zod
- UI: Tailwind + shadcn
- Icons: Lucide

---

# RULE 3 — DO NOT BREAK CURRENT STRUCTURE
Preserve and enhance current file structure.

## ALLOWED:
- Expand schemas.js
- Expand menu.js
- Add reusable components
- Improve CrudPage
- Add dashboards
- Add better cards/tables/forms
- Add module-specific UI wrappers
- Add local workflow simulation

## NOT ALLOWED:
- Full backend conversion
- Replacing TanStack Start
- Switching to Next.js
- Switching to FastAPI now
- Random architecture changes outside blueprint

---

# RULE 4 — IF REQUEST IS OUTSIDE BLUEPRINT
If user asks for something not defined in BOS blueprint:

### YOU MUST:
1. STOP
2. Explain clearly:
   - Why it is outside current BOS document
   - Which section conflicts
   - What impact it has on architecture
   - Whether it should be added as custom extension
3. Ask for confirmation BEFORE implementing

### RESPONSE FORMAT:
"Requested feature is outside current BOS Blueprint Scope because [detailed reason].
Affected Areas:
- Module:
- Schema:
- Workflow:
- UI Impact:

Would you like me to:
A) Keep BOS Blueprint strict
B) Extend BOS with this custom feature?"

---

# RULE 5 — FRONTEND SHOULD SIMULATE ENTERPRISE
Even without backend:
- Use localStorage as pseudo database
- Use seeded data
- Simulate:
  - company
  - branch
  - users
  - permissions
  - invoice states
  - payroll states
  - stock states
  - approvals
  - audit logs

---

# UI/UX DESIGN LAW (MANDATORY)

## USE BOS DESIGN SYSTEM FROM BLUEPRINT:
### COLORS:
- Navy: #1B2A4A
- Teal: #0D7377
- Slate: #2E4057
- Light Blue: #D6E8F5
- Mint Green: #D4EDE1
- Amber: #FFF3CD
- Pearl: #F4F6F9

### STYLE:
- Modern office
- Enterprise
- Branch-ready
- Dashboard-heavy
- Dense but clean
- Sidebar = module hierarchy
- Topbar = company + branch + user
- Cards = analytics first
- Tables = advanced CRUD
- Forms = drawer/modal
- Status badges everywhere

---

# MODULE STRUCTURE (STRICT)

## DASHBOARD
- Global Dashboard

## INVENTORY MANAGEMENT
- Dashboard
- Product Management
- Stock Management
- Warehouse Management
- Purchase Management
- Suppliers
- Sales Integration
- Asset Inventory
- Transfers
- Barcode & QR
- Reports
- Alerts
- Selling
- Audit Logs

## HUMAN RESOURCES
- Employees
- Payroll
- Attendance
- Leave
- Shifts
- Performance
- Recruitment
- Exit
- Assets
- Policies
- Compensation
- Departments
- Designations

## FINANCE MANAGEMENT
- Dashboard
- Accounts
- Invoices
- Expenses
- Payables
- Receivables
- Budgets
- Bank & Cash
- Payroll Finance
- Assets
- Taxes
- Reports
- Forecasting
- Audit Logs
- Settings

## SETTINGS
- Company
- Branches
- Users
- Roles & Permissions
- Preferences

---

# SCHEMA LAW
Every blueprint database field should become:
## CURRENTLY:
Frontend schema fields for forms/tables

Example:
Blueprint:
hr_employees.first_name
=> schemas.hrEmployees.fields.first_name

Blueprint:
fin_invoices.invoice_number
=> schemas.financeInvoices.fields.invoice_number

---

# CRUD LAW
Every module/submodule should support:
- Create
- Read
- Update
- Delete (soft delete preferred)
- Search
- Sort
- Filter
- Export
- Seed data
- Status badges

---

# AUTH MODE (FRONTEND ONLY)
For now:
Use localStorage seeded auth:
- SUPER_ADMIN
- COMPANY_ADMIN
- BRANCH_MANAGER
- VIEWER

Use AuthContext only.

No real JWT yet.

---

# DEVELOPMENT PRIORITY ORDER

## PRIORITY 1
Fix:
- menu.js to match BOS blueprint exactly
- schemas.js to match BOS blueprint fields
- dashboard UI
- CrudPage enterprise upgrade

## PRIORITY 2
Improve:
- analytics widgets
- reusable forms
- branch selector
- permission simulation

## PRIORITY 3
Prepare:
- backend-ready structure without implementing backend

---

# CODING STYLE RULES
- Production-grade code
- Reusable components
- No placeholders unless marked
- No fake shortcuts
- No oversimplified demos
- Use BOS terminology consistently
- Keep naming enterprise-standard

---

# WHEN GENERATING CODE:
Always explain:
1. What blueprint section it follows
2. What existing file it modifies
3. Why this structure matches BOS
4. Whether future backend migration remains compatible

---

# GOLDEN RULE
BOS is an enterprise operating system, not a demo admin panel.

Every UI decision must feel:
“Offline-first, branch-ready, enterprise-grade.”

---

# CURRENT IMPLEMENTATION REALITY
Although blueprint includes full production backend:
## RIGHT NOW:
You are ONLY building:
### "Enterprise Frontend Simulation Layer"

localStorage = temporary database
Schemas = temporary models
CrudPage = temporary ERP engine

Everything must be future-migratable to full BOS architecture.

---

# FINAL COMMANDMENT
Never randomly invent architecture.
Never simplify BOS blueprint.
Never bypass blueprint hierarchy.
Never implement outside scope without confirmation.
Always preserve current project while transforming it into BOS Blueprint UI.