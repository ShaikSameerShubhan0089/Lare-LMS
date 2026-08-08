# LARE — End-to-End AWS Deployment

Deploys the whole platform (26 services + gateway + React SPA) on **one EC2 box**
behind Nginx, with **RDS PostgreSQL** and **Redis** on the box. No Docker — each
service is a Gunicorn process under systemd (matches `deploy/lare@.service`).
Scale later by moving Redis to ElastiCache and adding EC2 replicas behind an ALB.

Placeholders to replace: `LMS.EXAMPLE.EDU` (domain), `CHANGE_ME` (passwords/keys),
`ap-south-1` (region), `sg-xxx` (security groups).

```
Internet ──443──> Nginx (EC2) ──/api──> Gateway :8000 ──127.0.0.1──> 26 services
                       └── / (static) ─> /opt/lare/frontend/dist
                                    services ──> RDS Postgres (:5432) + Redis (:6379)
```

---

## 1. RDS PostgreSQL (the database)

Console → RDS → Create database:
- Engine **PostgreSQL 16**, template **Production** (or Dev/Test to save cost).
- DB instance id `lare-db`, master user `lareadmin`, password `CHANGE_ME`.
- Instance `db.t3.small` (bump later), storage 20 GB gp3, **storage autoscaling on**.
- **Public access: No.** VPC = same as the EC2 you'll create. Create/attach a
  security group `sg-rds` that allows **inbound 5432 from `sg-ec2` only**.
- Initial database name: `lare`. Enable automated backups (7 days) + PITR.

CLI alternative:
```bash
aws rds create-db-instance --db-instance-identifier lare-db \
  --engine postgres --engine-version 16.4 --db-instance-class db.t3.small \
  --allocated-storage 20 --storage-type gp3 --master-username lareadmin \
  --master-user-password 'CHANGE_ME' --db-name lare \
  --vpc-security-group-ids sg-rds --no-publicly-accessible --backup-retention-period 7 \
  --region ap-south-1
```
Note the endpoint: `lare-db.xxxxx.ap-south-1.rds.amazonaws.com`.

---

## 2. EC2 instance

- **Ubuntu Server 22.04 LTS**, `t3.large` (2 vCPU/8 GB is comfortable for 26
  services + build; `t3.medium` works for a light demo). 30 GB gp3 disk.
- Same VPC/subnet as RDS. Security group `sg-ec2`:
  - Inbound **22** (SSH, your IP only), **80** and **443** (0.0.0.0/0).
  - Outbound: all.
- Add `sg-ec2` to the RDS security group's 5432 inbound rule (step 1).
- Allocate an **Elastic IP**, associate it, and point your domain's **A record**
  (`LMS.EXAMPLE.EDU`) at it (Route 53 or your registrar).

SSH in:
```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>
```

---

## 3. Server packages

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y python3 python3-venv python3-dev build-essential \
     git nginx redis-server postgresql-client bubblewrap curl ufw
# Node 20 for the frontend build:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
# Firewall (optional; SG already restricts):
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable
# App user + dirs:
sudo useradd --system --create-home --shell /usr/sbin/nologin lare || true
sudo mkdir -p /opt/lare /opt/lare/data /etc/lare
```

---

## 4. Get the code + Python venv + dependencies

```bash
# Copy your code to the server. Option A (git):
sudo git clone <YOUR_REPO_URL> /opt/lare
# Option B (no git): from your Windows box, scp the folder up, e.g.:
#   scp -i key.pem -r "C:/Users/S Sameer/Desktop/Lare-lms/*" ubuntu@<IP>:/opt/lare/

sudo chown -R $USER:$USER /opt/lare
cd /opt/lare/backend

python3 -m venv .venv
source .venv/bin/activate
pip install -U pip wheel

# Shared base + production extras:
pip install -r requirements-base.txt
pip install "gunicorn" "psycopg[binary]" "redis" "pyjwt[crypto]"

# Install every service's own requirements into the shared venv:
for d in services/*/; do
  [ -f "$d/requirements.txt" ] && pip install -r "$d/requirements.txt"
done
```

---

## 5. Build the frontend

```bash
cd /opt/lare/frontend
npm ci
npm run build            # outputs /opt/lare/frontend/dist  (Nginx serves this)
```
The SPA calls `/api/...` (relative) — Nginx proxies that to the gateway, so no
frontend env is needed.

---

## 6. Secrets, ports, and RS256 keys

```bash
# RS256 keypair (Auth signs, everyone verifies):
cd /etc/lare
sudo openssl genrsa -out jwt_priv.pem 2048
sudo openssl rsa -in jwt_priv.pem -pubout -out jwt_pub.pem

# Shared env + ports (from the repo templates):
sudo cp /opt/lare/backend/deploy/lare.env.example /etc/lare/lare.env
sudo cp /opt/lare/backend/deploy/ports.env        /etc/lare/ports.env
sudo nano /etc/lare/lare.env     # fill DATABASE_URL, keys, AI keys, domain, etc.
```
In `/etc/lare/lare.env` set the JWT keys from the PEMs (single line, `\n` for
newlines) — a quick way:
```bash
sudo bash -c 'echo "JWT_PRIVATE_KEY=$(awk "{printf \"%s\\\\n\", \$0}" /etc/lare/jwt_priv.pem)" >> /etc/lare/lare.env'
sudo bash -c 'echo "JWT_PUBLIC_KEY=$(awk "{printf \"%s\\\\n\", \$0}" /etc/lare/jwt_pub.pem)" >> /etc/lare/lare.env'
```
Make sure `DATABASE_URL` points at your RDS endpoint and lock it down:
```bash
sudo chown lare:lare /etc/lare/*.env /etc/lare/*.pem
sudo chmod 600 /etc/lare/*.env /etc/lare/*.pem
```

---

## 7. Create the database schemas + tables + column migrations

```bash
cd /opt/lare/backend
source .venv/bin/activate
export DATABASE_URL="postgresql+psycopg://lareadmin:CHANGE_ME@lare-db.xxxxx.ap-south-1.rds.amazonaws.com:5432/lare"

# One schema + tables per service (schema = service name; auth -> lare_auth):
while read -r name dir port; do
  [[ -z "$name" || "$name" == \#* || "$name" == "gateway" ]] && continue
  sch="$name"; [[ "$name" == "auth" ]] && sch="lare_auth"
  echo "== init-db $name (schema=$sch) =="
  ( cd "services/$dir" && DB_SCHEMA="$sch" python manage.py init-db )
done < <(tr -d '\r' < services.txt)

# Columns that create_all can't add to existing tables (idempotent):
( cd services/assessment && DB_SCHEMA=assessment python migrate_cols.py )
( cd services/coding     && DB_SCHEMA=coding     python migrate_cols.py )
( cd services/drive      && DB_SCHEMA=drive      python migrate_cols.py )
( cd services/curriculum && DB_SCHEMA=curriculum python migrate_cols.py )

# Seed the real content banks + a default admin:
( cd services/coding      && DB_SCHEMA=coding      python seed_practice.py )
( cd services/assessment  && DB_SCHEMA=assessment  python seed_worlds.py )
( cd services/assessment  && DB_SCHEMA=assessment  python seed_careers.py )
```

Create your **first admin** (so you can log in). Use the auth service's seed if
present, otherwise register via the API after go-live and promote in DB. Example
via the API once Nginx is up:
```bash
curl -sk https://LMS.EXAMPLE.EDU/api/auth/v1/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@your-domain","password":"StrongP@ss1","full_name":"Admin"}'
# then grant super_admin in the DB (psql) or via your existing admin bootstrap.
```

*(Optional) the 30-student demo dataset — run the same order as `seed-demo.ps1`
with `DB_SCHEMA=<service>`: auth→`lare_auth`, others→their name, `seed_practice`
with `DB_SCHEMA=coding`. Skip on a real launch.*

---

## 8. systemd — run all 27 units

```bash
sudo chown -R lare:lare /opt/lare
sudo cp /opt/lare/backend/deploy/lare@.service /etc/systemd/system/

# Auth uses the reserved schema name -> override to lare_auth:
sudo mkdir -p /etc/systemd/system/lare@auth.service.d
printf '[Service]\nEnvironment=DB_SCHEMA=lare_auth\n' | \
  sudo tee /etc/systemd/system/lare@auth.service.d/schema.conf

sudo systemctl daemon-reload
sudo systemctl enable --now \
  lare@auth lare@institution lare@learner lare@curriculum lare@content \
  lare@progress lare@assessment lare@gamification lare@certification \
  lare@candidate lare@drive lare@questionbank lare@exam lare@submission \
  lare@anticheat lare@coding lare@evaluation lare@interview lare@result \
  lare@notification lare@files lare@analytics lare@audit lare@ai_orchestration \
  lare@ai_tutor lare@organization lare@gateway

# Check:
systemctl --failed
curl -s http://127.0.0.1:8000/health
journalctl -u lare@assessment -n 30 --no-pager   # tail one if it fails
```

---

## 9. Nginx + TLS

```bash
sudo cp /opt/lare/backend/deploy/nginx.conf /etc/nginx/sites-available/lare
sudo sed -i 's/lms.example.edu/LMS.EXAMPLE.EDU/g' /etc/nginx/sites-available/lare
sudo ln -sf /etc/nginx/sites-available/lare /etc/nginx/sites-enabled/lare
sudo rm -f /etc/nginx/sites-enabled/default

# TLS certificate (domain must already resolve to this box):
sudo snap install --classic certbot && sudo ln -sf /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d LMS.EXAMPLE.EDU     # writes the cert + rewrites ssl_* paths

sudo nginx -t && sudo systemctl reload nginx
```

---

## 10. Verify

```bash
curl -s https://LMS.EXAMPLE.EDU/api/health          # gateway health via TLS
curl -s https://LMS.EXAMPLE.EDU/ | head             # SPA index.html
```
Open `https://LMS.EXAMPLE.EDU`, log in as your admin. Every page should work
because the DB schemas/columns are migrated and services are healthy.

---

## 11. Day-2: updates, backups, scaling

**Redeploy after code changes**
```bash
cd /opt/lare && git pull                       # or scp the new build
cd backend && source .venv/bin/activate
pip install -r requirements-base.txt           # if deps changed
# apply any new column migrations (see step 7), then:
sudo systemctl restart 'lare@*'                # restart all services
cd /opt/lare/frontend && npm ci && npm run build   # rebuild SPA
```

**Backups / DR** — RDS automated backups + PITR (enabled in step 1). Keep
`/etc/lare/*.env` and `jwt_*.pem` in AWS Secrets Manager, not only on the box.

**Scale for 1000 concurrent** — raise `WEB_CONCURRENCY` (env), move Redis to
**ElastiCache** (`REDIS_URL`), bump RDS class, and put 2+ EC2 boxes behind an
**ALB** (services are stateless; `/ready` gates health). Exam + coding are the
hot paths — give them more workers.

## Production checklist
- [ ] RDS reachable only from `sg-ec2`; EC2 exposes only 80/443 (+SSH from your IP)
- [ ] `JWT_ALG=RS256`, keys distributed; `INTERNAL_JWT_SECRET` set & unique
- [ ] `APP_ENV=production`, `DEBUG=false`, `CORS_ORIGINS=https://LMS.EXAMPLE.EDU`
- [ ] `EXEC_MODE=sandbox` and `bubblewrap` installed (coding sandbox)
- [ ] `REDIS_URL` set (event bus = Redis Streams)
- [ ] AI keys + email/SMS providers set
- [ ] `certbot renew` timer active (`systemctl list-timers | grep certbot`)
- [ ] `systemctl --failed` is empty
