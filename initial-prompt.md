# Initial Claude Code Prompt

Copy and paste the text below the line into Claude Code as your first message.

---

Please start by reading docs/requirements.md so you have the full picture alongside what is already in CLAUDE.md.

We are starting this project from scratch. Before writing any code I would like you to do two things:

**1. Propose a phased development plan**

Break the work into clear phases, each with a defined goal and a list of what gets built. A suggested starting point:

- Phase 1: Project scaffolding — Docker Compose, folder structure, Nginx config, environment variable setup, .gitignore
- Phase 2: Database — schema, migrations, seed script for local test users
- Phase 3: Backend foundation — Express/Fastify setup, session handling, Passport.js local auth, basic API skeleton
- Phase 4: File upload — multer, sharp thumbnail generation, EXIF extraction, disk space check, UUID filenames
- Phase 5: Frontend foundation — React/Vite setup, routing, login page (local auth mode), upload page
- Phase 6: Gallery — sushi bar view, portrait phone view, full-screen view, grid view
- Phase 7: Admin features — hide/unhide, deletion moderation queue, zip download with IPTC embedding
- Phase 8: Guest features — caption editing, deletion flagging
- Phase 9: Security hardening — helmet, zod validation, rate limiting, input sanitisation
- Phase 10: Production readiness — Google OAuth, Let's Encrypt, environment variable review, npm audit

Feel free to adjust, combine, or reorder phases if you see a better approach. Please flag any gaps or conflicts you notice in the requirements before we proceed.

**2. Scaffold the initial project structure**

Create the folder layout and the following starter files:
- `docker-compose.yml` (frontend, backend, nginx containers with named volumes)
- `frontend/package.json` (React + Vite)
- `backend/package.json` (Node.js + all planned dependencies)
- `nginx/nginx.conf` (reverse proxy config, placeholder for TLS)
- `.env.example` (all required environment variables with placeholder values and comments)
- `.gitignore` (Node, Docker, environment files)
- `backend/src/db/schema.sql` (full database schema based on requirements)
- `scripts/seed.js` (local auth seed script — ask me for the test user passwords when you are ready to write this file)

Please ask me any questions before you begin if anything is unclear.
