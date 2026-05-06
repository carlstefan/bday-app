# Implementation Prompt — Multi-Party Support

Use this prompt to brief Claude Code for the multi-party implementation. Paste it in full at the start of the session.

---

## Context

You are working on a birthday party photo submission app for Carl Stefan Grøtter. The app is currently a single-party app (one party, two admin roles). We are now evolving it into a multi-party platform.

All design decisions are fully documented. Read these files before writing any code:

- `docs/multiparty-design.md` — the complete multi-party design spec (roles, data model, URLs, UX, migration)
- `docs/birthday-party-app-requirements.md` — the base app requirements (updated to v6 with mobile UX and other changes)
- `CLAUDE.md` — project overview, stack, architecture decisions, environment details

Read all three documents in full before starting. Do not proceed based on assumptions — if something is unclear, refer to the docs first.

---

## What We Are Building

1. **Multi-party support** — the app can now host multiple independent parties, each with its own URL, gallery, roles, and settings
2. **New role hierarchy** — Super Admin (global) → Party Owner → Party Manager → Authenticated Guest → Anonymous
3. **Party-scoped URLs** — `/p/:partyKey/` for all party content
4. **A one-time migration** — existing data migrated to the first party (`tcs`)
5. **Several standalone UX fixes** — some of these can and should be done before the multi-party work

---

## Phase 0 — Standalone fixes (do these first, they are independent of multi-party)

These are small, self-contained changes to the existing single-party app. Apply them before starting the multi-party work so they land cleanly.

### 0a — Fix upload form placeholder name
The name field on the anonymous upload form currently uses a real person's name as placeholder text. Replace it with `"Ola Nordmann"` (the Norwegian equivalent of "John Doe"). This is a one-line fix in the upload form component.

### 0b — Remove mobile single-photo (portrait) view
FR-G04 is now superseded. The portrait/single-photo view on mobile has been removed. Grid view is now the default on all screen sizes. Update the gallery routing/logic so that:
- Grid view is shown by default on all screen widths
- Tapping any thumbnail opens full-screen view directly (on all screen sizes)
- Any routing or state that referenced the portrait view is removed

### 0c — Update full-screen overlay controls
The full-screen view (FR-G06) needs a slim overlay bar at the top containing:
- A grid/back button (always visible; exits full-screen and returns to grid)
- The 3-dot menu trigger (only if user is logged in)
- A flag/report button (only if user is logged in)

The bar auto-hides after 2–3 seconds of inactivity and reappears on tap (mobile) or mouse movement (desktop). No other UI chrome in full-screen. Uploader name and caption remain hidden in this view.

Anonymous users cannot access full-screen — tapping a photo when not logged in should prompt login instead.

### 0d — Add upload consent notice (FR-G11)
Add a small-font notice beneath the submit button on the upload page:
> *"By submitting photos, you accept that the party owner may use them for private purposes, including on their own private social media accounts."*

Shown on every upload for all users.

### 0e — Add submission state messages (FR-G13)
These messages are needed for the multi-party work but also apply to the single-party app once submissions are closed:
- If submissions are closed: *"The party owner is not currently allowing uploads."*
- If anonymous uploads are disabled and the user is not logged in: show a message that anonymous uploads are not allowed, with a prompt to log in

---

## Phase 1 — Database schema changes

Using the data model in `docs/multiparty-design.md` (Section 4), create:

1. `parties` table
2. `party_roles` table
3. `bans` table
4. Add `party_id` column to `photos`
5. Add `is_super_admin` column to `users`

Write these as a proper migration, not a destructive schema replacement. The existing data must survive.

---

## Phase 2 — One-time migration script

Create `scripts/migrate-to-multiparty.js` following the steps in `docs/multiparty-design.md` (Section 11):

1. Check if migration has already run (presence of `parties` table) — if so, exit cleanly with a log message
2. Apply schema changes from Phase 1
3. Insert the `tcs` party record with the exact name and description from the design doc
4. Assign all existing photos to the `tcs` party
5. Move files on disk: `uploads/*` → `uploads/tcs/*` and `thumbnails/*` → `thumbnails/tcs/*` (skip existing subdirectories)
6. Set `is_super_admin = 1` on the user with email `carlstefan@gmail.com`
7. Set Trude (email: find from existing users table, display name "Trude") as Party Owner of `tcs`

The script must:
- Be idempotent (safe to run twice without damage — just exits early on second run)
- Log every step clearly
- Exit with a non-zero code if any step fails
- Be run **manually once** as part of deployment — it must NOT run automatically on startup

---

## Phase 3 — Backend: party-scoped routing and authorization

1. **Party resolution middleware** — for all routes under `/p/:partyKey/*`, resolve the party record from the key and attach it to `req.party`. Return 404 if the party key does not exist.

2. **Authorization middleware** — implement `requirePartyRole(minRole)` that checks:
   - Is the user a Super Admin? → always allowed
   - Does the user have a `party_roles` row for this party with the required role or higher?
   - Is the user globally or party-banned? → reject with 403
   
   Role order for comparison: `owner > manager > guest`

3. **Party-scoped file serving** — update image serving routes to resolve file paths using the party key (e.g. `uploads/{partyKey}/{filename}` and `thumbnails/{partyKey}/{filename}`)

4. **Upload endpoint** — update to:
   - Require `party_id` on all uploads
   - Check `submissions_open` and `anonymous_uploads_enabled` for the party before accepting
   - Store files in the party-scoped subdirectory

5. **New party management API endpoints:**
   - `GET /api/parties` — list all parties (Super Admin only)
   - `POST /api/parties` — create a party (Super Admin only)
   - `GET /api/parties/:partyKey` — get party details
   - `PATCH /api/parties/:partyKey` — update party settings (Owner/Super Admin)
   - `GET /api/parties/:partyKey/users` — list party members (Owner/Super Admin)
   - `POST /api/parties/:partyKey/roles` — grant a role (Owner/Super Admin)
   - `DELETE /api/parties/:partyKey/roles/:userId` — revoke a role (Owner/Super Admin)
   - `POST /api/parties/:partyKey/bans` — ban a user from a party (Manager/Owner/Super Admin)
   - `POST /api/bans` — global ban (Super Admin only)
   - `GET /api/parties/:partyKey/archive` — download zip archive (Manager/Owner/Super Admin)
   - `PATCH /api/parties/:partyKey/featured-photo` — set featured photo (Owner/Super Admin)

6. **User account endpoints:**
   - `PATCH /api/user/display-name` — change own display name
   - `DELETE /api/user` — delete own account (sets `user_id` NULL on photos, removes roles/session)

7. **Login redirect** — after successful authentication (both Google OAuth and local), redirect to the `next` parameter if present. The `next` parameter must be passed through the full OAuth flow (store in session before redirect, restore after callback). Apply existing `next` validation rules (TR-S17).

---

## Phase 4 — Frontend: routing and party context

1. **React Router** — add routes:
   - `/` → promoted party front page (with party switcher)
   - `/p/:partyKey` → party front page
   - `/p/:partyKey/gallery` → gallery
   - `/p/:partyKey/upload` → upload
   - `/p/:partyKey/admin` → party admin panel
   - `/admin` → Super Admin panel

2. **Party context** — add a React context/store that holds the current party (resolved from the URL `:partyKey`). All components that need party data read from this context.

3. **Active-party switcher** — a small dropdown in the upper right showing parties where `submissions_open = true`. Shown to logged-out users and authenticated guests on the root front page. Hidden when there is only one or no active party. For admin/manager roles, party switching is in the 3-dot menu instead.

4. **Front page fallback** — if no party has `is_promoted = true`, show a brief explanatory message about the site rather than an error.

5. **Party front page fallback** — if `featured_photo_id` is null, show a friendly placeholder message instead of a broken image.

---

## Phase 5 — Frontend: 3-dot menu

Implement the universal 3-dot menu (⋮) in the upper right for all logged-in users. Menu sections are conditionally rendered by role. See `docs/multiparty-design.md` Section 7 for the exact structure:

- **Preferences** (all logged-in users): Change display name, Delete my account
- **Switch party** (multi-party users and Super Admin)
- **Moderation** (Manager, Owner, Super Admin): Moderate photos, Manage deletion requests, Download party archive
- **Party settings** (Owner, Super Admin): Submissions toggle (with confirmation popup), Anonymous uploads toggle, Featured photo picker, Manage users & roles
- **Super Admin panel** (Super Admin only)

The notification badge for pending deletion requests (FR-A04) should be shown on the 3-dot menu icon.

---

## Phase 6 — Frontend: party admin panel (`/p/:partyKey/admin`)

Build the party admin panel with three sections, role-gated as described in the design doc:
- Party settings (editable name, description, toggles, featured photo picker)
- Users & roles (list members, grant/revoke Manager, ban)
- Moderation (deletion requests, hidden photos, archive download)

The page header displays the party name.

---

## Phase 7 — Frontend: Super Admin panel (`/admin`)

Build a focused global-actions panel:
- Create new party form (party key, name, description) — validate key format (lowercase alphanumeric only) client-side before submit
- Set promoted party (dropdown of all parties)
- Global user search and ban
- Global anonymous uploads toggle
- Exit button (navigates back using browser history)

---

## Phase 8 — User account preferences

Add a Preferences panel (modal or separate page, your call) accessible from the 3-dot menu for all logged-in users:
- Change display name form
- Delete account button with confirmation dialog

---

## Constraints and things NOT to break

- **Do not run the migration script automatically** — it is a one-time manual step
- **Do not change the authentication strategy** — Passport.js with local/Google modes stays as-is
- **Do not alter the image storage format** — two sizes (original + 1000px thumbnail), UUID filenames, EXIF preserved
- **Do not remove existing security middleware** — helmet, rate limiting, session config, zod validation all stay
- **The audit log** (TR-B09) must be extended to cover new actions: role grants/revocations, bans, party creation, account deletion, display name change
- **TR-S17** (next parameter validation) must apply to the new party-aware redirect flow
- **All existing API endpoints** that are not being replaced must continue to work during the transition — migrate them to party-scoped versions without removing them until the frontend is fully updated

---

## Suggested commit strategy

- One commit per phase (or per logical chunk within a phase)
- Keep the migration script in a separate commit so it is easy to identify in the git log
- Phase 0 fixes can be committed as a single "housekeeping" commit before the multi-party work begins

---

## Definition of done

- Migration script runs cleanly against the existing database and moves all files correctly
- All existing photos appear in the `tcs` party gallery
- Carl Stefan (carlstefan@gmail.com) is Super Admin
- Trude is Party Owner of `tcs`
- A new party can be created from `/admin`
- Party front pages load at `/p/:partyKey`
- Role-based access control is enforced on both frontend and backend
- All Phase 0 fixes are live
- No regressions on existing functionality
