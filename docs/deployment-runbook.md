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
Nginx must reload to pick up the renewed cert — add a cron job on the VPS:

```bash
crontab -e
# Add:
0 3 * * * docker exec bday-app-nginx-1 nginx -s reload
```

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
  -v bday-app_db-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Backup uploads
```bash
docker run --rm \
  -v bday-app_uploads-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/uploads-backup-$(date +%Y%m%d).tar.gz -C /data .
```

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
