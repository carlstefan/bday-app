# Deployment Runbook

## Birthday Party Photo App — VPS Deployment

---

## Prerequisites

| Item | Notes |
|------|-------|
| VPS | Ubuntu 22.04 LTS, min 1 vCPU / 2 GB RAM / 20 GB disk |
| Domain | A record pointing to VPS IP |
| Google Cloud project | For OAuth credentials (production only) |
| This repo | Cloned to the VPS |

---

## Step 1 — Provision the VPS

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER  # add deploy user to docker group (log out/in after)

# Install Docker Compose plugin (v2)
apt-get install -y docker-compose-plugin

# Verify
docker compose version
```

---

## Step 2 — Clone the repository

```bash
git clone <your-repo-url> /srv/bday-app
cd /srv/bday-app
```

---

## Step 3 — Create .env from template

```bash
cp .env.example .env
nano .env   # fill in all values (see below)
```

### Required production values

```
NODE_ENV=production
AUTH_MODE=google

SESSION_SECRET=<long random string — use: openssl rand -hex 64>

ADMIN_EMAILS=carl.stefan@gmail.com,trude@gmail.com   # real Google account emails

GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback

PORT=3001
DB_PATH=/app/data/db.sqlite
UPLOADS_PATH=/app/uploads
```

---

## Step 4 — Obtain a Let's Encrypt certificate

**Edit `nginx/nginx.prod.conf`** first — replace `YOUR_DOMAIN` with your real domain.

```bash
# Start Nginx on port 80 only (no HTTPS yet) to complete the ACME challenge
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx certbot

# Obtain the certificate (replace yourdomain.com)
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com
```

---

## Step 5 — Register Google OAuth callback

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create or edit an **OAuth 2.0 Client ID** (Web application type)
3. Under **Authorised redirect URIs** add:
   ```
   https://yourdomain.com/api/auth/google/callback
   ```
4. Copy the **Client ID** and **Client Secret** into `.env`

---

## Step 6 — Deploy

```bash
cd /srv/bday-app
bash scripts/deploy.sh
```

This runs:
- `git pull`
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
- Image prune

---

## Step 7 — Verify

```bash
# Check all containers are running
docker compose ps

# Tail backend logs
docker compose logs -f backend

# Smoke test the API
curl -k https://yourdomain.com/api/health
# → {"status":"ok","timestamp":"..."}

# Check HTTPS certificate
curl -I https://yourdomain.com
# → HTTP/2 200, Strict-Transport-Security header present
```

Then open a browser:
- `https://yourdomain.com` — home page loads
- `https://yourdomain.com/login` — Google Sign-In button shown
- Sign in as Carl Stefan → is_admin should be true → `/admin` accessible

---

## Certificate Auto-Renewal

Certbot renews automatically via the `certbot` service (runs `certbot renew` every 12h).
The `--deploy-hook` in `docker-compose.prod.yml` reloads Nginx automatically whenever a cert
is actually renewed, so no separate cron job is needed.

> **Note:** the deploy hook uses `app-nginx-1` as the container name (derived from the project
> directory `/app` on the VPS). If you ever clone to a different path, pass
> `--project-name app` explicitly in the deploy command to keep the name stable.

---

## Ongoing Operations

### Deploy an update
```bash
cd /srv/bday-app && bash scripts/deploy.sh
```

### View logs
```bash
docker compose logs -f backend
docker compose logs -f nginx
```

### Backup the database
```bash
docker run --rm \
  -v app_db-data:/data \
  -v /backups:/out \
  alpine tar czf /out/db-$(date +%Y%m%d).tar.gz -C /data .
```

### Backup uploads
```bash
docker run --rm \
  -v app_uploads-data:/data \
  -v /backups:/out \
  alpine tar czf /out/uploads-$(date +%Y%m%d).tar.gz -C /data .
```

### Automated daily backups (set up once on the VPS)

```bash
crontab -e
# Add both lines:
0 2 * * * docker run --rm -v app_db-data:/data -v /backups:/out alpine \
  tar czf /out/db-$(date +\%Y\%m\%d).tar.gz -C /data . \
  && find /backups -name "db-*.tar.gz" -mtime +14 -delete

0 3 * * * docker run --rm -v app_uploads-data:/data -v /backups:/out alpine \
  tar czf /out/uploads-$(date +\%Y\%m\%d).tar.gz -C /data . \
  && find /backups -name "uploads-*.tar.gz" -mtime +7 -delete
```

Keeps 14 days of database backups and 7 days of upload backups in `/backups/` on the VPS host.

---

## Open Questions (resolve before going live)

| # | Question | Owner |
|---|----------|-------|
| OQ-01 | When should the gallery go live — before the party or only on the day? | Carl Stefan |
| OQ-02 | How long to keep the data after the party? | Carl Stefan |
| OQ-03 | Invite-only URL or open? | Carl Stefan |
| OQ-04 | Admin email addresses for Google OAuth | Carl Stefan + Trude |
| OQ-05 | Domain name | Carl Stefan |
| OQ-06 | VPS provider and spec | Carl Stefan |
| OQ-07 | Hero photo of Carl Stefan & Trude for the home page | Carl Stefan |
| OQ-08 | Colour palette / typography preferences | Carl Stefan |
