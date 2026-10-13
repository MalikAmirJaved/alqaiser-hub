# Nexus CRM / Al Qaiser BOS — Documentation Index

Professional project documentation for **Al Qaiser Nexus ERP** (Al-Qaiser BOS).

Use this folder as the single place to manage architecture, workflows, structure, bugs, and AI prompts. Keep `agent.md` (repo root) as the deep code reference; keep these files shorter and operational.

| Document | Purpose |
| -------- | ------- |
| [architecture.md](./architecture.md) | System design, stack, layers, multi-tenancy, realtime |
| [workflow.md](./workflow.md) | Dev, deploy, auth, request, and business workflows |
| [filestructure.md](./filestructure.md) | Repository layout and where to put new code |
| [bugfoundresolved.md](./bugfoundresolved.md) | Bug log — found, root cause, resolution |
| [setup.md](./setup.md) | Local development setup checklist |
| [conventions.md](./conventions.md) | Coding and git conventions |
| [../prompt.md](../prompt.md) | AI agent system prompt for this codebase |
| [../agent.md](../agent.md) | Full technical source of truth (detailed) |
| [../CHANGELOG.md](../CHANGELOG.md) | Versioned release notes |
| [../documentation.txt](../documentation.txt) | End-user product guide |

## How to maintain these docs

1. **New feature** → update `CHANGELOG.md`, touch `workflow.md` / `architecture.md` if behavior or APIs change.
2. **Bug fix** → add a row/section in `bugfoundresolved.md`, then summarize in `CHANGELOG.md`.
3. **Structural change** (new app, folder, route) → update `filestructure.md` and the tree in `agent.md`.
4. **AI work** → keep `prompt.md` + `agent.md` aligned; never invent APIs that are not in the code.

For the shared Sales quote/invoice editor, see [workflow.md](./workflow.md) for the page, conversion, and status flow and [architecture.md](./architecture.md) for shared preview/print rendering. User-facing instructions belong in [`../documentation.txt`](../documentation.txt).

## Current branch context

Local development is **non-Docker** (Docker compose removed). Backend runs via Daphne; Celery worker/beat are started separately. See `backend/cmd` and [setup.md](./setup.md).
