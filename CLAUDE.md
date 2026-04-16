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
Warm, bright, happy summer vibe. Generous whitespace. Friendly typography. UI frames photos without competing with them. Hero image of Carl Stefan & Trude to be added to front page (placeholder during development).

## Full requirements
@docs/requirements.md

## Local network access (important for development)
- The app runs in Docker Desktop on a Windows PC and must be reachable from other devices on the local network (phones, tablets) for testing
- Nginx and Docker Compose port bindings must use `0.0.0.0` — not `127.0.0.1`
- All frontend API calls must use relative URLs (`/api/...`) routed through Nginx — never hardcoded `localhost` or ports
- Use `AUTH_MODE=local` for all local and LAN testing — Google OAuth requires HTTPS + a registered domain and will not work over a LAN IP
- The host machine's LAN IP (found via `ipconfig`) is how other devices reach the app, e.g. `http://192.168.1.x`
- For internet access: router port forwarding to the host machine; for Google OAuth testing: use ngrok for a temporary public HTTPS tunnel

## Current status
Planning phase — no code written yet. Start by proposing a phased development plan and scaffolding the project structure.
