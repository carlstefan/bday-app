# Birthday Party Photo App — Claude Briefing

## Project
Carl Stefan & Trude's 50th Birthday Party Photo Submission App.
A full-stack web app for guests to upload and browse party photos.
Owner: Carl Stefan Grøtter (use both names — "Carl Stefan", not just "Carl").

## Stack
- **Frontend**: React (Vite), single-page application
- **Backend**: Node.js with Express or Fastify
- **Database**: SQLite via `better-sqlite3` or Drizzle ORM
- **Auth**: Passport.js — `passport-local` (development), `passport-google-oauth20` (production)
- **Image processing**: `sharp`
- **Validation**: `zod` on all API request bodies
- **Security**: `helmet`, `bcrypt`, `express-session`
- **Infra**: Docker Compose, Nginx reverse proxy, Let's Encrypt TLS, VPS deployment

## Auth modes
- `AUTH_MODE=local` — username/password login, test users seeded via `scripts/seed.js`
- `AUTH_MODE=google` — Google OAuth 2.0 (production only)
- Defaults to `local` if variable is not set

## Key architectural decisions
- Images stored on Docker volume (filesystem), never in the database
- Two image sizes only: 1000px JPEG thumbnail (generated at upload via `sharp`) + full original
- Thumbnails stored in `thumbnails/` subdirectory; originals in `uploads/`
- EXIF preserved as-is; `DateTimeOriginal` extracted and stored as `captured_at`
- Files stored with UUID filenames — never the original filename
- All image files served via authenticated backend route (no public static access)
- Disk usage checked before each upload via `fs.statfs()`; warn at 90%, block at 95%
- UTF-8 used consistently throughout the entire stack
- SQLite created with `PRAGMA encoding='UTF-8'`

## Actors
- **Anonymous user**: can upload photos, cannot browse gallery
- **Authenticated guest**: can upload, browse gallery, edit own captions, flag photos for deletion
- **Admin** (Carl Stefan / Trude): hide/unhide photos, moderate deletion requests, download archive

## Database tables (summary)
- `users`: id, google_id (nullable), username (nullable), password_hash (nullable), display_name, email, is_admin, created_at
- `photos`: id, filename, original_name, uploader_name, caption, user_id (nullable FK), is_hidden, captured_at, created_at
- `deletion_requests`: id, photo_id (FK), flagged_by_user_id (FK), flagged_at, status, resolved_by_user_id (nullable), resolved_at (nullable)

## Gallery UX (summary)
- **Portrait phone**: single photo view, swipe left/right; swipe down → 2×3 thumbnail grid
- **Sushi bar** (480px+): 3/5/7 images depending on viewport; centre image large; scroll wheel navigates; no vertical scroll
- **Full-screen**: tap centre image; full original always loaded; pinch/scroll to zoom; swipe navigates when at 1×
- **Grid view** (1024px+ toggle): full viewport of thumbnails; normal scroll; click → sushi bar at that photo
- Thumbnails used for all grid/flanking positions; full image for sushi bar centre on 1024px+ and full-screen view
- Uploader name and caption shown in sushi bar centre only — not in full-screen view

## Design intent
Warm, bright, happy summer vibe. Generous whitespace. Friendly typography. UI frames photos without competing with them. Hero image (Carl Stefan & Trude kissing, dramatic warm light flare between them) to be placed at `frontend/public/hero.jpg` — use as full-width background on front page top section, cropped to a reasonable height but with both faces fully visible.

## Full requirements
@docs/requirements.md

## Environments

Two environments are maintained in parallel using Docker Compose override files.

### Local (dev / pre-prod)
- Runs on Windows PC via Docker Desktop
- URL (LAN): `http://10.0.0.12:8081`
- URL (internet via port forwarding): `http://88.88.91.176:8081`
- `AUTH_MODE=local` — username/password, seed script runs on startup
- HTTP only — no TLS
- Port mapping: `0.0.0.0:8081:80` in docker-compose.local.yml
- All API calls use relative URLs (`/api/...`) via Nginx — never hardcoded ports
- Start: `docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local up -d`

### Production (VPS — one.com)
- URL: `https://cs.grotter.net`
- IPv4: `85.190.99.39`
- IPv6: `2001:880:0:21::1d8`
- SSH: `administrator@85.190.99.39` (key: `~/.ssh/id_ed25519`)
- `AUTH_MODE=google` — Google OAuth 2.0
- HTTPS via Nginx + Certbot (Let's Encrypt); ports 80 and 443 must be open
- Certificate domain: `cs.grotter.net`; HTTP-01 challenge requires port 80 to remain accessible
- Google OAuth redirect URI: `https://cs.grotter.net/auth/google/callback`
- Git remote: `https://github.com/carlstefan/bday-app`
- Deploy: `ssh administrator@85.190.99.39 "cd /app && git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build"`

### Environment files
- `.env.local` — local secrets (gitignored)
- `.env.prod` — production secrets (gitignored, stored separately from repo)
- `.env.example` — committed template with all required variable names and descriptions

## Current status
Feature-complete for v1. All functional and technical requirements are implemented and running locally. Remaining before production launch: Google OAuth credentials (TR-S04), domain DNS cutover, Let's Encrypt certificate provisioning, and production VPS deployment (Phase 10 runbook in `docs/deployment-runbook.md`).
