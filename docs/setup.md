# Local Setup — Al Qaiser Nexus ERP

> Non-Docker setup (compose removed from repo).  
> Quick commands also live in `backend/cmd`.

---

## 1. Prerequisites

| Dependency | Notes |
| ---------- | ----- |
| Python 3.12+ | Backend |
| Node.js 20+ (or Bun) | Frontend |
| PostgreSQL 15+ | Primary DB |
| Redis 7+ | Channels, cache, Celery |
| ffmpeg | Monitoring / HLS (optional if not using CCTV) |

---

## 2. Backend

```bash
cd backend
python -m venv venv

# Windows PowerShell
.\venv\Scripts\Activate.ps1
# Linux/macOS
# source venv/bin/activate

pip install -r requirements.txt
```

### Environment

Create/configure `backend/.env` (do not commit). Typical keys:

- `SECRET_KEY`, `DEBUG`, `FRONTEND_URL`, `ALLOWED_HOSTS`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- `REDIS_HOST`, `REDIS_PORT`
- JWT TTLs, seed org/admin vars (`ORG_*`)

Frontend must allow the same origin CORS/`FRONTEND_URL` as your Next.js host.

### Database init

```bash
python manage.py migrate
python manage.py seed_org
python manage.py seed_permissions
# optional demo data:
# python manage.py seed_data --count 20
```

### Run API (ASGI — required for WebSockets)

```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Celery (forecasts)

```bash
celery -A config worker --loglevel=info
celery -A config beat --loglevel=info
```

### Tests

```bash
python manage.py test
```

Health check: `GET http://localhost:8000/health/` → `{"status":"healthy"}`.

---

## 3. Frontend

```bash
cd frontend
npm install
# or: bun install

# .env
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

Default UI: `http://localhost:3000`  
Login: `/login`

**Security:** change default admin credentials immediately after first login.

---

## 4. Suggested process layout (dev machine)

| Process | Command | Port |
| ------- | ------- | ---- |
| PostgreSQL | service / docker external | 5432 |
| Redis | service | 6379 |
| Daphne | see above | 8000 |
| Next.js | `npm run dev` | 3000 |
| Celery worker | see above | — |
| Celery beat | see above | — |

---

## 5. First-login product checklist

1. Login → change admin password / email / username  
2. Settings → Company profile (currency, schedule)  
3. Departments → Designations → Users → Permissions  
4. Add employees / products as needed  

Full user guide: [`../documentation.txt`](../documentation.txt).

---

## 6. Related

- [workflow.md](./workflow.md)  
- [architecture.md](./architecture.md)  
- [`../agent.md`](../agent.md) § Environment Variables  
