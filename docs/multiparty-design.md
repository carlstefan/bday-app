# Multi-Party Support — Design Document

**Status:** Design complete, implementation not started  
**Author:** Carl Stefan Grøtter  
**Date:** 2026-05-06  

---

## 1. Overview

The app is evolving from a single-party photo submission tool into a platform that can host multiple parties. Carl Stefan Grøtter becomes the Super Admin with global authority. Each party is a self-contained unit with its own URL, gallery, uploads, roles, and settings.

The initial party (Carl Stefan & Trude's 50th birthday) will be migrated into this new structure as the first party record.

---

## 2. Role Hierarchy

Roles are global or party-scoped as described below, ordered from highest to lowest authority:

### Super Admin (global)
- Carl Stefan Grøtter only
- Stored as `is_super_admin = true` on the user record — not a party role
- Full authority across all parties
- Can create parties, set the promoted party on the front page, perform global bans, globally toggle anonymous uploads, and grant/revoke any role in any party

### Party Owner (party-scoped)
- Designated per party; a party may initially have no owner
- Can promote registered users to Party Manager and demote them
- Can open/close submissions for their party
- Can enable/disable anonymous uploads for their party
- Can set the featured photo for their party's front page
- Can ban users from their party
- Has all Party Manager moderation capabilities

### Party Manager (party-scoped)
- Appointed by Party Owner or Super Admin
- Can hide/unhide photos
- Can edit captions
- Can moderate (approve/reject) deletion requests
- Can download the party photo archive
- Can ban users from their party

### Authenticated Guest (party-scoped)
- A registered user with an active role in a specific party
- Can upload photos, browse the gallery, edit their own captions, and flag photos for deletion

### Anonymous User
- Not logged in
- Can upload photos to parties where anonymous uploads are enabled (per-party setting, on by default)
- **Cannot** browse the gallery or access the full-screen view

---

## 3. The Party Concept

A **party** is the top-level organisational unit. Every photo, user role, and setting belongs to exactly one party.

### Party fields
| Field | Notes |
|---|---|
| `id` | Integer primary key, used as FK throughout the database |
| `party_key` | Unique, indexed, immutable slug (lowercase letters and numbers only, no spaces or special characters). Used in URLs and as the disk folder name. |
| `name` | Display name, shown in the browser tab, gallery header, and admin page. Supports international characters. Editable by Party Owner/Super Admin. |
| `description` | Shown on the party front page. Supports international characters. Editable by Party Owner/Super Admin. |
| `submissions_open` | Boolean toggle. When false, no uploads are accepted (anonymous or logged-in). Requires confirmation before disabling. |
| `anonymous_uploads_enabled` | Boolean toggle. When `submissions_open` is false, this is effectively overridden to false and the toggle is greyed out in the UI. On by default. |
| `is_promoted` | Boolean. Only one party may be promoted at a time. The promoted party is shown on the root front page (`/`). Enforced at the application layer. |
| `featured_photo_id` | FK to a photo in this party's gallery. Displayed as the hero image on the party front page. Selected from existing uploaded photos via the admin panel. |
| `created_at` | Timestamp |

### Party key rules
- Lowercase letters (`a–z`) and digits (`0–9`) only
- No spaces, hyphens, underscores, or special characters
- Must be unique across all parties
- **Immutable after creation** — changing it would require migrating URLs, disk folders, and database FKs, which is not supported

---

## 4. Data Model Changes

### New table: `parties`
```sql
CREATE TABLE parties (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  party_key                 TEXT    NOT NULL UNIQUE,
  name                      TEXT    NOT NULL,
  description               TEXT    NOT NULL DEFAULT '',
  submissions_open          INTEGER NOT NULL DEFAULT 1,  -- boolean
  anonymous_uploads_enabled INTEGER NOT NULL DEFAULT 1,  -- boolean
  is_promoted               INTEGER NOT NULL DEFAULT 0,  -- boolean
  featured_photo_id         INTEGER REFERENCES photos(id) ON DELETE SET NULL,
  created_at                TEXT    NOT NULL DEFAULT (datetime('now'))
);
PRAGMA encoding='UTF-8';
```

### New table: `party_roles`
```sql
CREATE TABLE party_roles (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_id         INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  role             TEXT    NOT NULL CHECK(role IN ('owner', 'manager', 'guest')),
  granted_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, party_id)
);
```

### New table: `bans`
```sql
CREATE TABLE bans (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_id         INTEGER REFERENCES parties(id) ON DELETE CASCADE,  -- NULL = global ban
  reason           TEXT,
  banned_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
```
A `party_id` of NULL represents a global ban (Super Admin only). A party-scoped ban prevents the user from accessing that party's gallery and uploading.

### Modified table: `users`
Add columns:
```sql
ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0;
```

### Modified table: `photos`
Add column:
```sql
ALTER TABLE photos ADD COLUMN party_id INTEGER REFERENCES parties(id);
```
After migration, `party_id` should be treated as NOT NULL by the application (all existing photos will be assigned to the `tcs` party).

### Unchanged tables
- `deletion_requests` — already linked to `photos`, which now carries `party_id`, so party scope is inherited

---

## 5. URL Structure

All party-specific content is scoped under `/p/:partyKey`. The root URL shows the promoted party.

| URL | Description |
|---|---|
| `/` | Root front page — renders the promoted party's front page, plus the active-party switcher |
| `/p/:partyKey` | Party front page — hero/featured image, description, upload CTA, login link |
| `/p/:partyKey/gallery` | Photo gallery for this party |
| `/p/:partyKey/upload` | Upload form for this party |
| `/p/:partyKey/admin` | Party admin panel (Party Owner, Party Manager, Super Admin) |
| `/admin` | Super Admin panel (global settings, create party, global bans, promoted party selection) |

### Auth routes remain global (not party-scoped)
- `/auth/google` and `/auth/google/callback` (production)
- `/auth/login`, `/auth/logout` (local dev)

### Login redirect
After authentication, the user must be returned to the party page they came from. The `next` redirect parameter must carry the party-scoped URL (e.g. `/p/tcs`) through the OAuth flow. The existing validation rules for the `next` parameter (TR-S17) apply unchanged.

---

## 6. Disk Organisation

Photos are stored in party-scoped subdirectories:

```
uploads/
  tcs/          ← originals for the "tcs" party
  wedding2026/  ← originals for another party
thumbnails/
  tcs/
  wedding2026/
```

All file serving routes must include the party key when constructing file paths. The party key is resolved from the `party_id` on the photo record.

---

## 7. UI & UX

### Root front page (`/`)
- Identical layout to a party front page
- Shows the promoted party's hero image, name, and description
- **Active-party switcher** appears in the upper right corner for logged-out users and authenticated guests: a small dropdown listing all parties where `submissions_open = true`
- The switcher is not shown if there is only one active party, or none
- **If no party is promoted:** show a brief explanatory text about what the site is for, with no error or broken layout

### Party front page (`/p/:partyKey`)
- Hero image: the party's `featured_photo_id` image (full-width, same treatment as current hero.jpg)
- Party description shown below the hero
- Upload CTA and login link
- No active-party switcher (you're already on a specific party)
- **If no featured photo is set yet:** display a friendly placeholder message (e.g. "No featured photo yet — upload some photos and set one from the admin panel"). This message is visible to all visitors; the suggestion to set one is only meaningful to Party Owners/Admins.
- Party front page **remains accessible via direct URL even after `submissions_open` is set to false** — the upload CTA is hidden/disabled but the page and gallery are still reachable

### Submission and upload state messages
- **Submissions closed:** if `submissions_open = false`, the upload area shows: *"The party owner is not currently allowing uploads."*
- **Anonymous uploads disabled:** if `anonymous_uploads_enabled = false` and the user is not logged in, the upload area shows a message explaining that anonymous uploads are not allowed for this party, with a prompt to log in

### Browser tab title
Uses the party `name` field (e.g. "Trude og Carl Stefans 100-årsdag")

### Gallery header
Party `name` displayed at the top of the grid

### Anonymous user access
Anonymous users (not logged in) **cannot** access the gallery or full-screen view. Attempting to navigate to the gallery shows the existing login prompt (FR-AU02). The full-screen view is not accessible at all — tapping a photo prompts login instead.

### 3-dot menu (⋮) — universal for all logged-in users
The 3-dot menu is present in the upper right corner of every page for **all logged-in users**, regardless of role. Menu sections are shown or hidden based on the user's role in the current party.

**Preferences** (visible to all logged-in users):
- Change display name
- Delete my account

**Switch party** (visible to users with roles in multiple parties, and Super Admin):
- List of all parties the user has a role in (Super Admin sees all parties)

**Moderation** (visible to Party Manager, Party Owner, Super Admin):
- Moderate photos (hide/unhide)
- Manage deletion requests
- Download party archive

**Party settings** (visible to Party Owner, Super Admin):
- Submissions toggle (open/closed) — disabling requires confirmation popup
- Anonymous uploads toggle — greyed out when submissions are closed
- Featured photo picker
- Manage users & roles (view members, grant/revoke Manager role, ban users)

**Super Admin panel** (visible to Super Admin only):
- Enter Super Admin panel

For logged-out users (anonymous): only the active-party switcher is shown (in the upper right, not a 3-dot menu).

### Full-screen view — overlay controls
The full-screen view displays a slim overlay bar at the top of the screen containing three controls:
- **Grid button** — exits full-screen and returns to grid view
- **3-dot menu** — same menu as described above (only shown if logged in)
- **Flag button** — flags the photo for deletion (only shown if logged in)

The overlay bar **auto-hides** after 2–3 seconds of inactivity and **reappears on tap** (mobile) or mouse movement (desktop). This keeps the photo unobstructed while ensuring controls are always accessible.

### Party admin panel (`/p/:partyKey/admin`)
Header shows the party name. Accessible from the 3-dot menu. Contains:

**Party settings** (Party Owner and Super Admin):
- Party name (editable text field)
- Description (editable text area)
- Submissions toggle — disabling shows confirmation: *"Are you sure you want to close submissions for this party?"*
- Anonymous uploads toggle — greyed out and forced off when submissions are closed
- Featured photo picker — scrollable grid of the party's uploaded photos; selecting one sets it as the hero image

**Users & roles** (Party Owner and Super Admin only):
- List of all users with a role in this party
- Grant Party Manager role / revoke Party Manager role
- Ban user from this party

**Moderation** (Party Manager, Party Owner, Super Admin):
- Manage deletion requests (list of flagged photos with approve/reject/delete actions)
- Moderate hidden photos (restore or permanently delete)
- Download party archive (zip of all non-deleted photos for this party)

### Super Admin panel (`/admin`)
Focused on global actions only — not a navigation hub. Contains:

**Parties:**
- Create new party (form: party key, name, description)
- Set promoted party (select from list of all parties, regardless of submission status)

**Global user management:**
- Search users across all parties
- Issue global bans
- Enable/disable anonymous uploads globally (overrides all per-party settings)

**Navigation:**
- Exit button — returns to the page the Super Admin navigated from

---

## 8. User Account Management

All logged-in users (except Super Admin, who manages the platform rather than a party) can access account preferences via the **Preferences** section of the 3-dot menu.

### Change display name
- User can update their display name at any time
- The new name is stored on the `users` record and reflected in newly uploaded photos going forward
- Previously uploaded photos retain the name at the time of upload (stored in `uploader_name` on the `photos` table)

### Delete account
- User can permanently delete their account
- **Photos are not deleted** — they remain in the gallery attributed to the display name stored at upload time; the `user_id` FK on those photos is set to NULL
- Party roles and bans associated with the account are removed via cascade
- A confirmation dialog is shown before deletion: *"Are you sure? Your photos will remain in the gallery but your account and login access will be removed permanently."*

---

## 9. Upload Page — Consent Text

A small-font notice is displayed beneath the submit button on the upload page for all parties:

> *"By submitting photos, you accept that the party owner may use them for private purposes, including on their own private social media accounts."*

This text is shown on every upload, not just the first time.

---

## 10. Party Creation Flow

1. Super Admin opens the Super Admin panel (`/admin`)
2. Fills in the create party form: party key, name, description
3. Party is created with no Party Owner; `submissions_open = true`, `anonymous_uploads_enabled = true`
4. Super Admin shares the party URL (`/p/:partyKey`) with the intended Party Owner
5. That person visits the URL and signs in with Google (production) or creates a local account (dev), creating their user record
6. Super Admin returns to the party's admin panel (`/p/:partyKey/admin`) and grants the user the Party Owner role

---

## 11. Migration Plan

A one-time migration script (`scripts/migrate-to-multiparty.js`) handles the transition. It is run manually once as part of the Phase 11 deployment, and is safe to run only once (it checks for the existence of the `parties` table before proceeding).

### Migration steps

1. **Schema changes** — create `parties`, `party_roles`, `bans` tables; add `party_id` to `photos`; add `is_super_admin` to `users`
2. **Seed the initial party** — insert the `tcs` party record:
   - `party_key`: `tcs`
   - `name`: `Trude og Carl Stefans 100-årsdag`
   - `description`: `Trude og Carl Stefan fyller begge 50 år i år, og dette vil vi feire med dere. Vi håper dere tar mange kule bilder og deler dem med oss gjennom denne siden!`
   - `submissions_open`: `1`
   - `anonymous_uploads_enabled`: `1`
   - `is_promoted`: `1`
3. **Assign all existing photos** to the `tcs` party (`UPDATE photos SET party_id = <tcs_id>`)
4. **Move files on disk** — move all files from `uploads/` to `uploads/tcs/` and from `thumbnails/` to `thumbnails/tcs/` (skipping any files already in subdirectories)
5. **Set Super Admin** — set `is_super_admin = 1` on Carl Stefan's user record (identified by email `carlstefan@gmail.com`)
6. **Grant Trude Party Owner role** — insert a row in `party_roles` for Trude with `role = 'owner'` for the `tcs` party

The script logs each step and exits with a non-zero code if any step fails, so the deployment can catch errors early.

---

## 12. Authorization Enforcement

Authorization is enforced at both frontend and backend:

### Backend middleware
- Every route under `/p/:partyKey/*` resolves the party from the key and attaches it to the request context
- A `requirePartyRole(minRole)` middleware checks `party_roles` (or `is_super_admin`) before allowing access to protected routes
- Party-scoped bans are checked on every authenticated request to a party route
- Global bans are checked on login

### Frontend
- UI elements (3-dot menu sections, upload button, gallery access) are conditionally rendered based on the user's role in the current party and login state
- Role information is included in the session/auth response and kept in client state

---

## 13. Open Items / Future Considerations

- **Date-based submission scheduling** — manual toggle is sufficient for v1; a scheduled open/close time could be added later
- **Multiple Party Owners** — currently one owner per party is assumed; supporting co-owners is straightforward but not in scope for v1
- **Party discovery** — currently no public directory of parties; guests must be given the direct URL by the party organiser
- **Invite-by-email flow** — currently Party Owners must sign in first before they can be granted a role; a pre-assigned invite link could be added in a future version
- **Per-party disk allocation** — disk usage is currently checked globally; if the platform grows to many parties, per-party quotas may be needed
- **Notification system** — no email notifications for flagged photos or role changes in v1
