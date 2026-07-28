# LARE — AWS Production Deployment Runbook

This is the LARE-specific version of the CEO's generic AWS guide. It deploys the
**real** platform: the API **gateway + 26 Flask microservices**, the **React/Vite
SPA**, **Redis**, and **Amazon RDS PostgreSQL** (schema-per-service) — two products
(LMS + Drive) from one codebase.

> **Why one container, not 26?** The gateway's upstream URLs *and* the internal
> event bus both default to `127.0.0.1:800x`. Running all 27 processes in a single
> network namespace (one image, supervisord) means **zero URL rewiring** — it
> behaves exactly like `run-all.ps1`. This is the smallest, safest leap from the
> working local setup. Splitting into 26 containers/Fargate tasks later requires
> setting every `*_URL` env var and moving the event bus to SNS/SQS first.

## What's in this folder

| File | Purpose |
|------|---------|
| `Dockerfile` | Backend image — gateway + 26 services under supervisord |
| `entrypoint.sh` | Reads `services.txt`, runs `init-db` per schema, generates the supervisord config |
| `requirements-all.txt` | Consolidated Python deps for the backend image |
| `web.Dockerfile` | Builds the React SPA and serves it + `/api` proxy via nginx |
| `nginx.conf` | SPA hosting + reverse proxy to the gateway (strips `/api`, SSE-safe) |
| `docker-compose.yml` | The full stack for one EC2 (backend + web + redis) |
| `.env.production.example` | Env template — copy to `.env.production` (gitignored) |

---

## Architecture (LARE, corrected)

```
Students / Recruiters
        │  HTTPS
     Route 53  (larecloudsolutions.com)
        │
   CloudFront  (optional CDN for the SPA)
        │
  Application Load Balancer  ← ACM TLS cert (443)
        │  :80
   ┌────────────── EC2 (Docker) ──────────────┐
   │  web (nginx)  →  SPA static + /api proxy   │
   │        │                                   │
   │  backend  ── gateway :8000                 │
   │        └── 26 services :8001–8026          │
   │  redis  (event bus + rate limit)           │
   └───────────────┬───────────────┬───────────┘
                   │               │
        Amazon RDS PostgreSQL   Amazon S3   Amazon SES / Zoho
        (26 schemas, 1 db)      (uploads)   (email)
```

---

## Phase 1 — Account & IAM
Same as the CEO guide: create the account, enable MFA, create an IAM admin user,
never use root. Region: **ap-south-1 (Mumbai)** for India-based students → lowest latency.

## Phase 2 — Domain
Buy in Route 53 (simplest — hosted zone is automatic) or point existing DNS to it.

## Phase 3 — RDS PostgreSQL (do this before the server)
1. RDS → Create database → **PostgreSQL**, engine default version.
2. Size: start **db.t4g.small** (not `micro`). *Why:* 27 processes each open a small
   pool. With `DB_POOL_SIZE=2 + DB_MAX_OVERFLOW=3` that's up to `27 × 5 ≈ 135`
   connections; `t4g.micro`'s `max_connections` (~80–110) is too low and will throw
   *"remaining connection slots reserved"* — the exact error hit on the Supabase pooler.
   `t4g.small` gives ~170+. Scale up for heavy drive days, down after.
3. One database (e.g. `lms`), one master user. **Schema-per-service is created
   automatically** by `entrypoint.sh` (`init-db` per service) — do **not** make 26 databases.
4. Security group: allow inbound **5432 from the EC2's security group only** (not public).
5. Enable automated backups (7–30 day retention) → covers the CEO's Phase 16.

## Phase 4 — EC2
- **Ubuntu Server 24.04 LTS**, **ap-south-1**.
- Size: **t3.large** (2 vCPU/8 GB) baseline; **t3.xlarge / c5.2xlarge** for drive days
  (300–1000 concurrent — matches the earlier ~8 vCPU sizing). Vertical scale, not an ASG
  (the localhost event bus can't span instances yet).
- Storage: **50–100 GB gp3**.
- Security group: **22** (SSH, your IP only), **80/443** from the ALB SG.

## Phase 5 — Install Docker on the instance
```bash
ssh -i key.pem ubuntu@EC2_PUBLIC_IP
sudo apt update && sudo apt -y upgrade
sudo apt -y install docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu && newgrp docker
```

## Phase 6 — Get the code & secrets onto the box
```bash
git clone <your-repo> lare && cd lare

# JWT keypair (RS256) — generate fresh for prod, or copy your existing pair.
mkdir -p deploy/keys
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out deploy/keys/jwt_priv.pem
openssl rsa -pubout -in deploy/keys/jwt_priv.pem -out deploy/keys/jwt_pub.pem

# Env: copy the template and fill in the real values.
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production     # DATABASE_URL (RDS), rotated API keys, SMTP, JWT secrets
```
**Rotate first:** the Mistral and Zoho keys were pasted in chat earlier — regenerate
both before putting them here. Better still, store all of these in **AWS Secrets Manager**
and load them at boot instead of a plaintext file (see Phase 10).

## Phase 7 — Build & launch the whole stack
```bash
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml logs -f backend   # watch init-db + 27 starts
```
Verify:
```bash
curl -s http://localhost/healthz                              # nginx edge
docker compose -f deploy/docker-compose.yml exec backend \
  curl -s http://127.0.0.1:8000/health                        # gateway (whole stack)
docker compose -f deploy/docker-compose.yml exec backend \
  supervisorctl status                                        # all 27 processes RUNNING
```
This one command replaces the CEO guide's Phases 6–8, 14, 15 (nginx, python env, deploy,
systemd) — Docker + supervisord handle process supervision and restarts.

## Phase 8 — Email
Keep **Zoho** (already paid, already configured) — nothing to change. Or switch to
**Amazon SES**: verify the domain, request production access (out of sandbox), and set
`EMAIL_PROVIDER`/SMTP vars to the SES endpoint. SES covers OTP, results, shortlist/regret mails.

## Phase 9 — Load balancer, TLS & DNS
1. **ACM** → request a public cert for `larecloudsolutions.com` and `*.larecloudsolutions.com`.
2. **Application Load Balancer** → HTTPS:443 listener using the ACM cert → target group
   → EC2 instance **:80**. Health check path: `/healthz`.
3. **Route 53** → A/ALIAS record for the domain → the ALB.
4. (Optional) **CloudFront** in front of the SPA for global caching — or serve the SPA
   from **S3 + CloudFront** and point only `/api/*` at the ALB. Same-origin `/api` keeps CORS simple.

## Phase 10 — Secrets Manager (hardening)
Move everything in `.env.production` into a Secrets Manager secret, give the EC2 an
IAM instance role with `secretsmanager:GetSecretValue`, and fetch+write the env file at
boot (user-data or a small entrypoint step). Removes plaintext secrets from disk.

## Phase 11 — S3 (uploads)
Create `lare-lms-storage`, grant the EC2 role `s3:PutObject/GetObject` on it, and set
`AWS_REGION` + `S3_BUCKET` in the env for the files service. Optional — local disk works to start.

## Phase 12 — Monitoring & logs
- **CloudWatch agent** on the EC2 → CPU/memory/disk + container logs (supervisord already
  writes each service to stdout/stderr, so `docker logs` / the agent capture them).
- **CloudWatch alarms** on CPU, RDS connections, ALB 5xx.
- **CloudTrail** for the account audit trail.

## Phase 13 — Backups
RDS automated snapshots (Phase 3) + optional **AWS Backup** plan. Retention 7–30 days.

---

## Day-2 operations

All commands run from the repo root (`-f deploy/docker-compose.yml`); export
`COMPOSE_FILE=deploy/docker-compose.yml` to drop the flag.

```bash
# Update to latest code (rebuilds only what changed)
git pull && docker compose -f deploy/docker-compose.yml up -d --build

# Restart one service without touching the other 26
docker compose -f deploy/docker-compose.yml exec backend supervisorctl restart exam

# Tail a single service's logs
docker compose -f deploy/docker-compose.yml exec backend supervisorctl tail -f evaluation stderr

# Re-run schema init (idempotent) after adding a model — recreate the container
docker compose -f deploy/docker-compose.yml up -d --force-recreate backend
```

## Scaling notes
- **Vertical first:** bump the EC2 instance type for drive windows, shrink after.
- **Redis is already wired:** with `redis` in the stack the event bus auto-selects Redis
  over HTTP fan-out, and gateway rate-limiting becomes shared — needed above a few hundred
  concurrent users. Swap the container for **ElastiCache** when you outgrow one box.
- **True horizontal scale (multi-instance ASG)** needs the event bus moved to **SNS/SQS or
  EventBridge** and the gateway upstreams pointed at internal load balancers — a real
  refactor, not a config change. Not required for launch.

## What differs from the CEO's generic guide
| CEO guide | LARE reality |
|-----------|--------------|
| FastAPI, `uvicorn main:app` | Flask via waitress, `manage.py serve` |
| One app on :8000 | Gateway :8000 + 26 services :8001–8026 (supervisord) |
| Nginx → one app | Nginx serves SPA + proxies `/api` → gateway |
| (no frontend step) | React/Vite build in `web.Dockerfile` |
| (no Redis) | Redis for event bus, rate limit, sessions |
| Auto Scaling Group | Single larger EC2 (event bus is localhost-bound) |
| db.t4g.micro | db.t4g.small+ (connection-pool math) |
| `.env` on disk | Secrets Manager (Phase 10) + rotate exposed keys |
