# LARE Platform — Backend (Monorepo)

Python 3.11+ / Flask microservices. **No Docker** — each service runs as its own
Gunicorn process (systemd in production). Local dev uses a per-service virtualenv.

## Layout
```
backend/
  libs/                     # shared, installable library (lare_common)
    pyproject.toml
    lare_common/
  services/
    auth/                   # Auth & Authorization Service (reference service)
    ...                     # (other services added incrementally)
  requirements-base.txt     # shared runtime deps
```

Each service owns its schema in one Supabase PostgreSQL cluster. Services never
touch another service's tables — only its API/events.

## Run a service locally (example: auth)

```powershell
cd backend/services/auth
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -e ../../libs            # install shared lare_common (editable)
copy .env.example .env               # then edit values

python manage.py init-db             # create tables
python manage.py seed                # seed roles + super admin
python manage.py run                 # dev server (Flask)  → http://127.0.0.1:8001
```

### Production-style run (Gunicorn)
```bash
gunicorn -c gunicorn.conf.py wsgi:app
```

## Database
- Default dev DB is **SQLite** (`DATABASE_URL=sqlite:///auth.sqlite3`) for zero-setup.
- Point `DATABASE_URL` at Supabase Postgres for real environments, e.g.
  `postgresql+psycopg://user:pass@host:5432/postgres`.

## Ports (dev convention)
| Service | Port |
|---|---|
| gateway | 8000 |
| auth | 8001 |
| (future services) | 8002+ |
