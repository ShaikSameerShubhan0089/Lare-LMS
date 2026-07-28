# LARE Platform — Deployment & Productionization Runbook

No Docker. Each of the 26 services runs as its own Gunicorn process behind Nginx,
managed by systemd. SQLite in dev; Supabase Postgres in production.

## 0. Topology
- **Nginx** terminates TLS and is the only public entry → proxies `/api/` to the
  **Gateway** (`:8000`). The SPA (`frontend/dist`) is served statically.
- **Gateway** verifies the JWT, injects trusted identity headers, strips spoofed
  ones, rate-limits, and routes to the 25 internal services (bind `127.0.0.1`).
- **Event bus**: Redis Streams in prod (`EVENT_BUS_BACKEND=auto` + `REDIS_URL`),
  HTTP fan-out in dev. Analytics + Audit are wildcard sinks.

## 1. Local / staging (SQLite, HTTP bus)
```bash
cd backend
./run-all.ps1            # init-db + serve all 26 services + gateway
./health.ps1             # poll every /health
./stop-all.ps1
```
Honcho alternative: `honcho start` (uses the Procfile).

## 2. Switch to Supabase Postgres (final step)
The `Database` helper already supports Postgres with a per-service schema via
`search_path` — no code change, only env. Each service gets its own schema
(`DB_SCHEMA=<service_name>`), giving the schema-per-domain layout in one cluster.

```bash
# one shared cluster, per-service schema, run everything against it:
./run-all.ps1 -DatabaseUrl "postgresql+psycopg://USER:PASS@HOST:5432/postgres" \
              -RedisUrl "redis://127.0.0.1:6379/0" \
              -JwtSecret "$PROD_JWT" -InternalSecret "$PROD_INTERNAL"
```
Install the driver into the shared venv first: `pip install "psycopg[binary]" redis`.

**One-time bootstrap** (create every schema + tables): `DATABASE_URL=… bash bootstrap-postgres.sh`
(idempotent; uses `create_all`. Alembic is the ongoing-migration path.)

**Reserved-schema caveat (Supabase):** Supabase reserves `auth`, `storage`,
`realtime`, `graphql`, `vault`, `cron`, `net`, `extensions`. The launcher and
bootstrap auto-map those to a `lare_` prefix — so our Auth service uses schema
**`lare_auth`**, not `auth` (which belongs to Supabase GoTrue). All other service
names are collision-free.

> **Status:** cutover done — 26 schemas / 95 tables live on Supabase (PG 17.6),
> verified: org write+read and seeded admin login both succeed on Postgres.

## 3. Migrations (Alembic, replaces create_all)
```bash
./scaffold-migrations.ps1                 # drops the shared template into each service
# per service (from its dir, with DATABASE_URL + DB_SCHEMA set):
alembic revision --autogenerate -m "init"
alembic upgrade head
```
`env.py` imports the service's `app.models`, targets `lare_common.db.Base.metadata`,
and pins the version table to the service schema on Postgres.

## 4. RS256 + JWKS (replace dev HS256)
```bash
pip install "pyjwt[crypto]"               # brings in `cryptography`
# generate a keypair:
openssl genrsa -out jwt_priv.pem 2048
openssl rsa -in jwt_priv.pem -pubout -out jwt_pub.pem
# set on Auth (signs) and every service + Gateway (verifies):
export JWT_ALG=RS256
export JWT_PRIVATE_KEY="$(cat jwt_priv.pem)"   # Auth only
export JWT_PUBLIC_KEY="$(cat jwt_pub.pem)"     # everyone (verify)
```
Auth publishes the key at `GET /auth/v1/.well-known/jwks.json`; the Gateway
verifies offline with `JWT_PUBLIC_KEY`. (Empty JWKS under dev HS256.)

## 5. Coding sandbox hardening
Prod sets `EXEC_MODE=sandbox` (auto when `APP_ENV=production`). The executor
prefers `nsjail`, then `bwrap` (network-off namespace, seccomp, rlimits,
read-only rootfs). A missing sandbox binary is **fatal in production** (never a
silent downgrade). Install one:
```bash
apt-get install -y bubblewrap        # or build nsjail
```

## 6. Email / SMS delivery
Notification adapters (stdlib only):
- `EMAIL_PROVIDER=smtp` (`SMTP_HOST/PORT/USER/PASSWORD/FROM/TLS`) or
  `EMAIL_PROVIDER=brevo` (`BREVO_API_KEY`, `BREVO_FROM`).
- `SMS_PROVIDER=twilio` (`TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM`).
`null` (default) logs and reports `sent` for dev.

## 7. systemd + Nginx
```bash
sudo cp deploy/lare@.service /etc/systemd/system/
# /etc/lare/lare.env  -> JWT_*, INTERNAL_JWT_SECRET, DATABASE_URL, REDIS_URL, provider creds
# /etc/lare/ports.env -> PORT_auth=8001 ... PORT_gateway=8000
sudo systemctl enable --now lare@auth lare@gateway lare@exam ...   # all 26
sudo cp deploy/nginx.conf /etc/nginx/sites-available/lare && sudo nginx -t && sudo systemctl reload nginx
```
Gunicorn config: `deploy/gunicorn.conf.py`.

## 8. Non-functional requirements (NFR #35)

### Scale — "1000 students at a time"
- Each service runs multiple Gunicorn workers (`deploy/gunicorn.conf.py`,
  `gthread`, workers = 2·CPU+1). Exam/Coding are the hot paths — scale their
  instances independently (more replicas behind the same Nginx upstream).
- Server-authoritative exam timers + idempotent submit mean a client retry storm
  never double-submits. Anti-cheat → Exam auto-submit is event-driven (Redis).
- **Load test** (baseline, single dev process): `595 req/s, 0% errors` at c=100.
  Validate your target hardware:
  ```bash
  python tools/loadtest.py --url https://lms.example.edu/api/lms/v1/... \
      -c 1000 -d 60 --header "Authorization: Bearer <token>"
  ```
  Watch `/metrics` (`lare_request_latency_ms_sum / lare_requests_total`) per service.

### Availability & DR
- **Stateless services** → run ≥2 replicas each; Nginx removes unhealthy ones
  (`/ready` gates readiness).
- **Postgres**: Supabase provides PITR + daily backups. Self-hosted:
  `pg_dump` nightly + WAL archiving; test restore quarterly.
- **Redis** is a cache/bus, not the source of truth — safe to lose; the HTTP
  fan-out fallback keeps events flowing if Redis is briefly down.
- **Files**: Supabase Storage (versioned bucket) or replicated object store.
- **RTO/RPO targets**: RPO ≤ 5 min (WAL), RTO ≤ 30 min (restore + redeploy from
  systemd units). Keep `/etc/lare/*.env` in a secrets vault, not on the box.

### Accessibility & responsiveness (frontend)
- Breakpoints 375 / 768 / 1024 / 1440 (see `frontend/DESIGN.md`); layouts use
  flex/grid with relative units — no fixed pixel widths on containers.
- `focus-visible` rings on all interactive elements; semantic buttons/labels;
  color contrast meets WCAG AA (ink-on-white, amber/teal tokens checked).
- Motion 150–300 ms and respects `prefers-reduced-motion`.
- Checklist per screen: keyboard-navigable, screen-reader labels on icon
  buttons, no horizontal body scroll at 375 px, tap targets ≥ 44 px.

### Browser compatibility
- Vite build targets modern evergreen browsers (Chrome/Edge/Firefox/Safari).
  The exam portal degrades gracefully where fullscreen/visibility APIs are
  unavailable (anti-cheat weights those signals lower).

## 9. Production checklist
- [ ] `DATABASE_URL` → Supabase; `DB_SCHEMA` per service; `alembic upgrade head` each
- [ ] `REDIS_URL` set → event bus = Redis Streams; gateway rate-limit = Redis
- [ ] `JWT_ALG=RS256`, keys distributed; `INTERNAL_JWT_SECRET` rotated
- [ ] `APP_ENV=production`, `DEBUG=false`, `CORS_ORIGINS` locked to the domain
- [ ] `EXEC_MODE=sandbox` with nsjail/bwrap installed
- [ ] Email/SMS providers configured; File storage → Supabase bucket
- [ ] TLS via Nginx; only `:8000` reachable; services bound to loopback
