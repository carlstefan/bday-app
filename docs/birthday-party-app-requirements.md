# Birthday Party Photo App — Requirements

**Project:** Carl Stefan & Trude's 50th Birthday Party Photo Submission App  
**Status:** Draft  
**Last updated:** 2026-04-27 (v5)  

---

## 1. Project Overview

A web application allowing guests at Carl Stefan & Trude's combined 50th birthday party to upload photos taken during the event. The app provides a public gallery for browsing submitted photos and a private admin interface for moderation and download. The app is deployed on a VPS using Docker and is expected to be active for a limited period around the event.

---

## 2. Actors

| Actor | Description |
|-------|-------------|
| **Anonymous user** | Anyone who reaches the app without being logged in — can submit photos but cannot browse the gallery |
| **Authenticated guest** | A party attendee who has logged in via Google — can submit photos and browse the full gallery |
| **Admin** | Carl Stefan or Trude — full access including hiding photos and downloading the archive |

---

## 3. Functional Requirements

Functional requirements are written as user stories in the format:  
`As a [actor], I want to [action], so that [benefit].`

Each story has an ID, a priority (`Must / Should / Could`), and acceptance criteria.

---

### 3.1 Authentication

**FR-AU01 — Sign in**  
*Priority: Must*

> As a party attendee, I want to log in so that I can access the gallery and be identified as the uploader of my photos.

Acceptance criteria — Google auth mode (`AUTH_MODE=google`):
- A "Sign in with Google" button is prominently displayed on the home page and gallery page
- Clicking it initiates the standard Google OAuth 2.0 flow
- On successful authentication, the user is returned to the page they came from
- The app stores the user's Google ID, display name, and email address
- A session (HTTP-only cookie) is created and maintained across page loads
- Users can sign out, which clears their session

Acceptance criteria — local auth mode (`AUTH_MODE=local`):
- A username and password form is displayed instead of the Google button
- On successful authentication the same session behaviour applies as in Google mode
- Failed login attempts return a generic error message without revealing whether the username or password was wrong
- Users can sign out, which clears their session

---

**FR-AU02 — Prompt anonymous users to log in when accessing the gallery**  
*Priority: Must*

> As an anonymous user who tries to view the gallery, I want to be told clearly that I need to log in, so that I understand why I can't see the photos.

Acceptance criteria:
- Navigating to the gallery without being logged in shows a clear message and a "Sign in with Google" button
- After signing in, the user is redirected to the gallery automatically

---

**FR-AU03 — Nudge anonymous uploaders to log in after submitting**  
*Priority: Should*

> As an anonymous user who has just uploaded a photo, I want to be encouraged to log in, so that I know I can view the full gallery.

Acceptance criteria:
- The upload confirmation screen includes a message such as: "Want to see everyone's photos? Sign in with Google to browse the gallery."
- The nudge is informational — anonymous users are not blocked from uploading

---

### 3.2 Anonymous User — Photo Submission

**FR-G01 — Upload one or more photos**  
*Priority: Must*

> As a user (anonymous or logged in), I want to upload one or more photos from my phone or computer in a single action, so that I can share my memories from the party without uploading one at a time.

Acceptance criteria:
- Any visitor can upload photos without being logged in
- Multiple files can be selected in a single upload action (via file picker or drag-and-drop)
- Maximum 20 files per upload batch
- Supported formats: JPEG, PNG, HEIC, WebP
- Maximum file size: 50 MB per photo
- EXIF metadata is preserved as-is — no stripping
- Live Photos from iPhone are accepted as static images — the motion component is not preserved (browser limitation, no special handling required)
- A progress indicator is shown during upload
- User receives a confirmation message when the upload succeeds
- User receives a clear error message if the upload fails
- Uploaded photos are associated with the user's account if they are logged in, or stored anonymously if not
- Before accepting any upload, the server checks available disk space and rejects the upload with a clear message if disk usage exceeds 95%

---

**FR-G02 — Add a name and caption at upload time**  
*Priority: Should*

> As a user uploading photos, I want to add my name and a shared caption for the batch, so that others know who took them and what they show.

Acceptance criteria:
- If the user is logged in, the name field is pre-filled with their Google display name but remains editable
- Name field is optional, max 60 characters
- Caption field is optional, max 200 characters
- When uploading multiple photos, the name and caption apply to the entire batch — each photo receives its own individual copy stored in the database
- Name and caption are displayed in the gallery alongside each photo

---

**FR-G03 — Edit caption on own photos after upload**  
*Priority: Should*

> As a logged-in guest, I want to edit the caption on photos I have uploaded, so that I can correct mistakes or add context after the fact.

Acceptance criteria:
- Caption editing is accessed via the action menu on own photos (see FR-G10)
- The user can update the caption (max 200 characters) and save it
- The updated caption is reflected in the gallery immediately
- Users can only edit captions on their own photos — not on photos uploaded by others or anonymously
- Anonymous uploads cannot be edited (no user association to verify ownership)

---

### 3.3 Authenticated Guest — Gallery

Gallery access is restricted to logged-in users. All gallery views display only non-hidden, non-flagged photos, sorted by EXIF capture time (`DateTimeOriginal`), falling back to upload time if EXIF is unavailable. Hidden and flagged photos are invisible to guests in all views.

---

**FR-G04 — Gallery: mobile single-photo view**  
*Priority: Must*

> As a guest on a mobile phone, I want to see one photo at a time with easy navigation and a quick way to switch to the grid overview, so that I can browse photos naturally on a small screen.

Acceptance criteria:
- On screens narrower than 480px CSS width, the default gallery view shows one photo at a time filling the screen width, rendered using the 1000px thumbnail
- Swiping left or right navigates to the previous or next photo
- A grid icon in the upper-left corner switches to the grid view (FR-G07)
- Tapping the photo opens the full-screen view (FR-G06)
- The uploader name and caption are shown beneath the photo

---

**FR-G05 — *(Superseded)***  
*The sushi bar carousel view has been replaced by the grid-first approach (FR-G07). This requirement is no longer active.*

---

**FR-G06 — Gallery: full-screen view**  
*Priority: Must*

> As a guest, I want to view a photo at full quality filling my entire screen, with the ability to zoom in and swipe through photos, so that I can appreciate the details.

Acceptance criteria:
- On mobile: entered by tapping a photo in the single-photo view (FR-G04)
- On larger screens: entered by clicking any thumbnail in the grid (FR-G07)
- The full original image is always loaded regardless of screen size
- The image fills the entire screen with no UI chrome except a minimal close/back control — no uploader name or caption is shown, keeping the view clean for inspecting the image
- Navigation — touch: swipe left/right to move to the previous/next photo; keyboard: left/right arrow keys; mouse: scroll wheel zooms (does not navigate)
- Zooming — touch: pinch to zoom in/out; mouse: scroll wheel zooms in/out
- When the image is zoomed in beyond 1×, swiping or dragging pans the image rather than navigating to the next photo; navigation resumes when zoom returns to 1×
- Dismissing the full-screen view — touch: swipe down or tap the close control; keyboard: Escape; mouse: click the close control — returns the user to the view they came from, at the same photo position

---

**FR-G07 — Gallery: grid view**  
*Priority: Must*

> As a guest, I want to see photos in a responsive grid so I can get an overview of all submissions and jump to any photo.

Acceptance criteria:
- Default view on screens 480px CSS width and above
- Available on all screen sizes — on mobile it is reached via the grid icon in FR-G04
- The number of columns is responsive: approximately 2 columns on small/portrait screens, 3–4 on tablets, 4–6+ on wide/desktop screens; the exact count should feel visually balanced for the screen width
- Thumbnails are rendered using the 1000px thumbnail
- The scroll wheel scrolls the page normally up and down through the full photo collection
- On mobile: tapping a thumbnail returns to the single-photo view (FR-G04) at that photo
- On screens 480px and above: tapping a thumbnail opens the full-screen view (FR-G06) directly
- The uploader name and caption are shown as a subtle overlay or below each thumbnail

---

**FR-G08 — Flag a photo for deletion**  
*Priority: Should*

> As a logged-in guest, I want to flag a photo for deletion, so that I can request removal of a photo I uploaded or report one I find inappropriate.

Acceptance criteria:
- For **own photos**: flagging is accessed via the action menu (FR-G10); the photo is **immediately hidden** from all non-admin users and marked as flagged pending admin review
- For **other guests' photos**: a separate, lighter-weight report icon is visible on each photo; flagging marks the photo as pending admin review but **does not hide it** — it remains visible in the gallery until an admin acts on it
- In both cases the flagged photo appears in the admin moderation view (FR-A02)
- The user who flagged receives a confirmation appropriate to the action taken (e.g. "Your photo has been hidden pending review" for own photos; "This photo has been reported and will be reviewed by an admin" for others' photos)
- A photo can only be flagged once — if already flagged, the option is not shown

---

**FR-G09 — Filter gallery to show only own photos**  
*Priority: Should*

> As a logged-in guest, I want to filter the gallery to show only the photos I have uploaded, so that I can quickly find and manage my own contributions.

Acceptance criteria:
- A toggle or filter control is available in all gallery views (portrait phone, sushi bar, grid)
- When the filter is active, only photos associated with the logged-in user's account are shown
- The filter state is indicated clearly (e.g. highlighted button or label)
- The filter persists across view changes (sushi bar ↔ grid) within the same session but resets on sign-out
- If the user has no uploaded photos, a friendly empty state message is shown

---

**FR-G10 — Action menu on own photos**  
*Priority: Should*

> As a logged-in guest viewing one of my own photos, I want a quick-access action menu, so that I can edit the caption or flag it for deletion without hunting for separate controls.

Acceptance criteria:
- An action menu icon (e.g. a three-dot or ellipsis button) is visible on own photos in the mobile single-photo view (FR-G04) and in the full-screen view (FR-G06), but only for photos belonging to the logged-in user
- Opening the menu presents exactly two options: **Update caption** and **Flag for deletion**
- Selecting **Update caption** opens an inline or modal edit field pre-filled with the existing caption (see FR-G03)
- Selecting **Flag for deletion** initiates the flagging flow (see FR-G08)
- The action menu is not shown on other users' photos or on anonymously uploaded photos

---

### 3.4 Admin — Moderation

**FR-A01 — Hide inappropriate photos**  
*Priority: Must*

> As an admin, I want to hide photos I find inappropriate, so that other guests don't see them while I retain the ability to review or restore them.

Acceptance criteria:
- Admins log in via Google, with admin status determined by a configurable list of Google account email addresses (stored in environment variables)
- Every photo in the gallery has a "Hide" button visible only to admins
- Clicking "Hide" immediately removes the photo from the guest gallery view
- Hidden photos remain visible to admins, clearly marked as hidden
- Admins can restore a hidden photo with an "Unhide" button
- There is no approval queue — photos are visible to authenticated guests immediately upon upload

---

**FR-A02 — Moderate flagged photos**  
*Priority: Should*

> As an admin, I want to review photos that have been flagged, so that I can decide what to do with each one.

Acceptance criteria:
- A dedicated admin view lists all photos currently flagged, showing: thumbnail, uploader name, caption, whether the photo is currently hidden, flag timestamp, and the display name of the user who flagged it
- For each flagged photo, the admin can choose one of three actions:
  - **Delete image** — permanently deletes the image file and database record; irreversible
  - **Hide image** — hides the photo from the gallery (if not already hidden) and dismisses the flag; equivalent to an admin hide
  - **Reject deletion** — removes the flag and restores the photo to its pre-flag visibility state (visible if it was not hidden before being flagged; remains hidden if it was already hidden by an admin)
- Each action requires a single click and takes effect immediately
- The moderation view distinguishes between own-photo flags (photo already hidden) and other-user flags (photo still visible) so the admin has the right context at a glance

---

**FR-A03 — Download all photos**  
*Priority: Should*

> As an admin, I want to download all submitted photos as a zip archive, so that I can keep them after the party.

Acceptance criteria:
- Admin can trigger a download of all photos (including hidden ones, excluding permanently deleted ones) as a single `.zip` file
- Filenames in the archive follow the pattern `YYYYMMDD_HHMMSS_[uploader_name].jpg`
- Each image in the archive has the uploader name and caption embedded as IPTC metadata, so the information travels with the file independently of the database

---

**FR-A04 — Admin notification badge**  
*Priority: Should*

> As an admin, I want to see a notification indicator when there are pending actions requiring my attention, so that I don't have to check the admin panel manually.

Acceptance criteria:
- A notification badge is visible to admins at all times (e.g. on a persistent admin menu icon or header element)
- The badge shows a count of items requiring attention: flagged photos awaiting moderation
- The badge disappears when there are no pending items
- Clicking the badge or notification takes the admin directly to the relevant moderation view
- The count updates in near real-time without requiring a full page reload (e.g. polling every 30 seconds or on navigation)

---

**FR-A05 — Hidden images gallery**  
*Priority: Should*

> As an admin, I want to browse all hidden photos in a dedicated gallery view, so that I can review what is hidden and restore photos if needed.

Acceptance criteria:
- A shortcut in the admin panel opens a gallery view showing all currently hidden photos (admin-hidden and own-photo flags that were auto-hidden)
- The view uses the same gallery UX as the main gallery (sushi bar / grid depending on screen size) but scoped to hidden photos only
- Each photo in this view shows an **Unhide** button allowing the admin to restore it to the main gallery
- Photos pending deletion moderation are also visible here if they are in a hidden state, with their pending status clearly indicated
- This view is accessible only to admins and is not linked from the guest-facing UI

---

## 4. Technical Requirements

Technical requirements describe the implementation constraints and architecture decisions.

---

### 4.1 Infrastructure & Deployment

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-I01 | The application is packaged using Docker Compose with separate containers for frontend, backend, and a shared volume for stored images | Must |
| TR-I02 | The app is deployable on a single VPS running Linux with a minimum of 1 vCPU and 1 GB RAM | Must |
| TR-I03 | TLS termination is handled by a reverse proxy (e.g. Nginx or Traefik) with certificates managed via Let's Encrypt | Must |
| TR-I04 | The app must be functional on mobile browsers (iOS Safari, Android Chrome) without requiring a native app install | Must |
| TR-I06 | Nginx and Docker Compose port bindings must listen on `0.0.0.0` (all interfaces) so the app is reachable from any device on the local network via the host machine's LAN IP — not just from `localhost` | Must |
| TR-I07 | All frontend API calls must use relative URLs (e.g. `/api/photos`) routed through Nginx — never hardcoded hostnames or ports; this ensures the app works correctly when accessed from other devices on the network or from the internet | Must |
| TR-I08 | During local development on Windows, Docker Desktop is used; Windows Defender Firewall must permit inbound connections on port 80; Docker Desktop typically creates this rule automatically but it should be verified if other devices cannot reach the app | Should |
| TR-I09 | `AUTH_MODE=local` must be used for all LAN and home network testing; Google OAuth (`AUTH_MODE=google`) requires HTTPS with a registered domain and is not compatible with LAN IP addresses or plain HTTP | Must |
| TR-I10 | For optional internet access during local development, the router can forward port 80 to the host machine's LAN IP; for testing Google OAuth locally without a VPS, a tunnelling tool such as ngrok provides a temporary public HTTPS URL | Could |

---

### 4.2 Internationalisation & Encoding

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-I05 | UTF-8 encoding is used consistently throughout the entire stack: SQLite database created with `PRAGMA encoding='UTF-8'`; all API responses include `Content-Type: application/json; charset=utf-8`; the React app declares `<meta charset="UTF-8">` in the document head; all Node.js file read/write operations specify UTF-8 encoding explicitly; original filenames from uploads are stored as-is in the database, preserving Norwegian, Swedish, and Danish characters (ø, æ, å, Ø, Æ, Å, ö, ä, ü, etc.) | Must |

---

### 4.3 Frontend

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-F01 | Frontend is built with React (Vite) as a single-page application | Must |
| TR-F02 | The UI is fully responsive and optimised for use on mobile devices | Must |
| TR-F03 | The admin interface is a separate route (`/admin`) protected by authentication | Must |

---

### 4.4 Backend

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-B01 | Backend is a Node.js application using Express or Fastify | Must |
| TR-B02 | File uploads are handled server-side using `multer` or equivalent | Must |
| TR-B03 | Uploaded images are stored on a Docker volume (local filesystem), not in the database; HEIC files are stored as-is without conversion | Must |
| TR-B04 | A JPEG thumbnail (1000px on the longest side, quality 85, aspect ratio preserved) is generated server-side at upload time using `sharp` and stored in a `thumbnails/` subdirectory alongside the originals; this thumbnail is used for all grid views, flanking sushi bar images, and the sushi bar centre on screens below 1024px CSS width | Must |
| TR-B05 | Original images are stored exactly as uploaded — no compression or format conversion is applied unless the file exceeds 50 MB, in which case it is re-encoded as JPEG at quality 85 with EXIF preserved | Must |
| TR-B06 | Before accepting any upload, the backend checks available disk space using a single `fs.statfs()` call; if disk usage exceeds 90% a warning is logged and surfaced to admins; if disk usage exceeds 95% the upload is rejected with a clear error message | Must |
| TR-B07 | At upload time, the EXIF `DateTimeOriginal` field is read from the image and stored as `captured_at` in the database before any processing; if absent, `captured_at` is set to the upload timestamp | Must |
| TR-B08 | The API is RESTful; all endpoints are documented with example request/response payloads | Should |
| TR-B10 | The zip archive builder must exclude photos where a `deletion_requests` row exists with `status = 'deleted'`; the filter must use the value `'deleted'` (not `'accepted'`) to match the status values defined in the data schema | Must |
| TR-B09 | All major actions are written to the `audit_log` table immediately on completion; the following event types and their metadata payloads are required: `login` → `{ username, success, auth_mode }`; `register` → `{ display_name, username }` (local mode only); `upload` → `{ photo_ids, count }`; `update_caption` → `{ photo_id, old_caption, new_caption }`; `flag_deletion` → `{ photo_id, is_own_photo, auto_hidden }`; `admin_moderate` → `{ photo_id, action: 'delete'\|'hide'\|'reject' }`; `admin_unhide` → `{ photo_id }`; `admin_download` → `{ photo_count }` | Must |

---

### 4.5 Data

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-D01 | SQLite is used as the database, accessed via `better-sqlite3` or Drizzle ORM | Must |
| TR-D02 | The database file is stored on a Docker volume so it persists across container restarts | Must |
| TR-D03 | A `users` table stores: `id`, `google_id` (nullable, populated in Google auth mode only), `username` (nullable, populated in local auth mode only), `password_hash` (nullable, populated in local auth mode only), `display_name`, `email`, `is_admin`, `created_at` | Must |
| TR-D04 | The `photos` table stores: `id`, `filename`, `original_name`, `uploader_name`, `caption`, `user_id` (nullable FK to `users`), `is_hidden`, `captured_at`, `created_at` | Must |
| TR-D05 | A `deletion_requests` table stores: `id`, `photo_id` (FK to `photos`), `flagged_by_user_id` (FK to `users`), `flagged_at`, `is_own_photo` (boolean — true if the flagger is the uploader), `status` (`pending` / `deleted` / `hidden` / `rejected`), `resolved_by_user_id` (nullable FK to `users`), `resolved_at` (nullable) | Must |
| TR-D06 | A seed script runs automatically at application startup when `AUTH_MODE=local`; it checks whether the predefined test users exist and inserts them with bcrypt-hashed passwords if not; the script is idempotent and never executes in Google auth mode | Must |
| TR-D07 | An `audit_log` table stores: `id`, `event_type` (enum — see TR-B09), `user_id` (nullable FK to `users`), `ip_address`, `metadata` (JSON — event-specific payload), `created_at` | Must |

---

### 4.6 Security & Auth

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-S01 | Authentication is handled via Passport.js with two strategies: `passport-google-oauth20` in production (`AUTH_MODE=google`) and `passport-local` with bcrypt password verification in development (`AUTH_MODE=local`); both strategies produce an identical session, so the rest of the application is unaware of which strategy is active | Must |
| TR-S02 | User sessions are managed via HTTP-only, signed session cookies (e.g. `express-session` with a strong secret) | Must |
| TR-S03 | Admin status is determined by matching the authenticated user's Google email against a list stored in an environment variable (`ADMIN_EMAILS=carl@example.com,trude@example.com`) | Must |
| TR-S04 | Google OAuth credentials (Client ID and Client Secret) are stored as environment variables and never committed to the repository | Must |
| TR-S05 | File type validation is performed server-side by inspecting file headers (magic bytes), not just the MIME type declared by the client; full image decode validation is implicit — thumbnail generation via `sharp` will throw an error if the file cannot be decoded as a valid image, and the upload is rejected at that point with no separate validation step required; for HEIC files, the ISO Base Media File Format brand field (bytes 8–11) must additionally be validated against known HEIC brands (`heic`, `heix`, `heim`, `heis`, `hevc`, `hevx`, `mif1`) to reject MP4, MOV, and other ISO-BMFF containers that share the same `ftyp` box header | Must |
| TR-S06 | The upload endpoint applies rate limiting to prevent abuse: max 100 uploads per IP per hour; the login endpoint is also rate-limited (max 20 attempts per IP per hour) to slow down brute-force attempts | Should |
| TR-S07 | Uploaded image files are stored with a UUID as the filename (not the original filename); the serving route requires an authenticated session before returning any image file | Must |
| TR-S08 | The `helmet` middleware is applied to all API responses, setting security headers including `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, and `Strict-Transport-Security`; image files are served with the correct `Content-Type` header so the browser never reinterprets them as scripts | Must |
| TR-S09 | Session cookies are configured with `HttpOnly`, `Secure`, and `SameSite=Strict` attributes; sessions expire after a reasonable inactivity period (e.g. 24 hours) | Must |
| TR-S10 | All API request bodies are validated using `zod` schemas before any processing; name and caption fields must be sanitised server-side using a proven library (e.g. `sanitize-html`) or by rejecting `<` and `>` characters outright — a regex that strips `<tag>` patterns is insufficient as it can be bypassed by unclosed tags; React's automatic output escaping provides a second layer of defence at render time | Must |
| TR-S11 | Docker containers run as a non-root user; the uploads and database volumes are mounted only in the backend container; only the Nginx reverse proxy container is reachable from the internet — the backend runs on an internal Docker network with no externally exposed port | Must |
| TR-S12 | `npm audit` is run before deployment and after any dependency updates to check for known vulnerabilities | Should |
| TR-S13 | An `AUTH_MODE` environment variable controls the active authentication strategy: `local` for development (username/password form), `google` for production (Google OAuth); the application defaults to `local` if the variable is not set | Must |
| TR-S14 | The application must refuse to start if `SESSION_SECRET` is missing or shorter than 32 characters; a startup check must throw a clear error rather than silently falling back to a hardcoded default | Must |
| TR-S15 | On successful login (both local and Google OAuth strategies), the session ID must be regenerated via `req.session.regenerate()` before the authenticated user is attached to the session, preventing session fixation attacks | Must |
| TR-S16 | On logout, the session must be fully destroyed server-side via `req.session.destroy()` and the session cookie must be explicitly cleared via `res.clearCookie()` — calling `req.logout()` alone is insufficient as it leaves the session row intact and the cookie valid | Must |
| TR-S17 | The `next` redirect parameter used to return users to their intended page after login must be validated to reject any value starting with `//` or `\\` or containing `:`, in addition to requiring a leading `/`; this validation must be applied consistently in both the backend route handler and all frontend redirect logic | Must |
| TR-S18 | In Google OAuth mode, the authenticated user's email is only used — and admin status only granted — if `profile.emails[0].verified` is `true`; unverified email addresses must be treated as absent | Must |
| TR-S19 | bcrypt password comparison must use the async `bcrypt.compare()` API rather than `bcrypt.compareSync()` to avoid blocking the Node.js event loop during login requests | Should |
| TR-S20 | Deletion flag requests are rate-limited per authenticated user (max 5 flags per hour) in addition to the existing per-IP API rate limiter, to prevent a malicious user from flooding the admin moderation queue or immunising photos against legitimate reports | Should |
| TR-S21 | Image serving routes (thumbnails and originals) must use `Cache-Control: private, no-cache, must-revalidate` rather than a long `max-age`, so that photos hidden or deleted by an admin are not continued to be served from the browser cache | Should |

---

### 4.7 Local Development Configuration

When `AUTH_MODE=local`, the following test users are seeded into the database at startup. Passwords are stored as bcrypt hashes — plaintext passwords are defined only in the seed script, which is a development-only file and is never deployed to production.

> ⚠️ **Operational security note:** The local environment must never be exposed to the public internet with `AUTH_MODE=local` active. Router port-forwarding to port 8081 should only be used for short-lived testing sessions and disabled at all other times. The seeded test passwords are intentionally weak and are not safe for any internet-facing deployment. Production always uses `AUTH_MODE=google`.

| Full name | Display name | Username | Role |
|-----------|--------------|----------|------|
| Carl Stefan Grøtter | Carl Stefan | cs | Admin |
| Trude Dale Sivertsen | Trude | trude | Admin |
| Preben Refsum Grøtter | Preben | preben | Guest |
| Marita Grøtter Raaholt | Marita | marita | Guest |

---

## 5. Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | The gallery must load within 3 seconds on a 4G mobile connection | Should |
| NFR-02 | The app must handle at least 50 simultaneous users without degradation | Should |
| NFR-03 | Photos (full-size and thumbnails) must not be accessible via direct URL to unauthenticated users | Must |
| NFR-04 | Expected photo storage volume is 2–5 GB for a party of 100–200 guests; a Docker volume of 20 GB provides comfortable headroom | Informational |
| NFR-05 | Disk usage is monitored before each upload; a warning is logged at 90% usage and uploads are disabled at 95% — this threshold is unlikely to be reached in normal use | Must |

---

## 6. Design & Visual Identity

The app should feel warm, bright, and celebratory — a happy summer party, not a corporate tool. The overall impression should put guests in a good mood the moment they open it.

**Guiding principles**

- Warm, sunny colour palette — think summer light, not cold blues or greys
- Generous use of whitespace; uncluttered and airy
- Friendly, approachable typography — readable at all sizes, nothing stiff or formal
- Imagery is the hero — the UI should frame photos beautifully without competing with them
- Subtle animations and transitions are welcome where they add joy without slowing things down

**Front page**

A hero image of Carl Stefan and Trude has been provided and should be used as a background on the upper section of the front page. The image is a portrait-orientation photo of the two of them sharing a kiss, with a dramatic warm light flare between them — it has a romantic, celebratory feel that fits the summer vibe perfectly.

Placement and cropping guidelines:
- Use as a full-width background image on the top section of the front page
- Crop height as needed so the section is not overly tall, but both faces must remain fully visible and uncropped
- A subtle dark or warm-tinted overlay may be used to ensure any text overlaid on the image remains readable
- File: `frontend/public/hero.jpg` (or `frontend/src/assets/hero.jpg`) — to be placed in the project by Carl Stefan

The front page should immediately communicate the occasion — a shared 50th birthday celebration — and invite guests to upload or sign in.

**Colour palette**

A warm pastel palette has been chosen to match the party's theme and complement the tones in the hero photo. The palette should draw from soft peach, warm cream, and dusty rose as primary tones, with sage or warm grey as neutral accents. Typography and UI elements should feel light and airy against this backdrop — nothing heavy or saturated. Exact colour values are left to the implementation, but should be derived from the warmth of the hero image rather than chosen independently.

---

## 7. Out of Scope (for v1)

The following items are explicitly excluded from the initial version:

- Login via Facebook or Apple (Google only for v1)
- Social sharing features
- Video uploads
- Comments or reactions on photos
- Email notifications
- Guests being able to delete their own uploads directly (deletion requires admin approval via the flagging workflow)
- Editing the uploader name after upload (caption editing only)
- Serving more than two image sizes (thumbnail and original) — the 1000px thumbnail covers all gallery views; the full original is used for the sushi bar centre on large screens and the full-screen view

---

## 8. Open Questions

Track decisions that still need to be made here before development starts.

| # | Question | Owner | Status |
|---|----------|-------|--------|
| OQ-01 | Should the gallery (and upload) be live before the party, or only activated on the day? | Carl Stefan/Trude | Open |
| OQ-02 | What happens to the app and data after the party — a specific retention period before the VPS is decommissioned? | Carl Stefan/Trude | Open |
| OQ-03 | Should anonymous uploads be allowed at all, or should uploading also require Google login? | Carl Stefan/Trude | Open |
| OQ-04 | Which Google account email addresses should have admin access? | Carl Stefan/Trude | Open |
| OQ-05 | Should the app be invite-only (e.g. a shared link with a token), or open to anyone who discovers the URL? | Carl Stefan/Trude | Open |
| OQ-06 | Hero photo provided; warm pastel colour palette chosen to match party theme — soft peach, warm cream, dusty rose, sage accents | Carl Stefan | Resolved |
| OQ-07 | Domain name for VPS deployment — Carl Stefan has a domain available; decision needed on when to point it at the VPS (recommended: point it early when the VPS is provisioned, even before the app is announced, so Let's Encrypt and Google OAuth can be tested properly) | Carl Stefan | Open |
| OQ-08 | VPS provider and specification — which provider, how much RAM/CPU/disk? Minimum spec is 1 vCPU / 1 GB RAM / 100 GB disk but provider choice affects deployment details | Carl Stefan | Open |

---

## 9. Working with Claude on This Project

Since this is your first AI-assisted development project, here are some practical tips for using Claude effectively:

**Use this document as your source of truth.** Share it with Claude at the start of each session. You can paste it into the chat or ask Claude to read it from your working folder. Claude doesn't retain memory between sessions, so providing context upfront avoids drift.

**Be specific when asking for code.** Reference requirement IDs where relevant (e.g. "Implement TR-B02 — file upload handling in Express"). This keeps Claude aligned with your documented decisions.

**Ask Claude to challenge your requirements.** Before writing code, you can ask: *"Are there any gaps or conflicts in these requirements?"* — Claude is good at spotting edge cases you may not have considered.

**Use Claude for scaffolding, then review.** Claude works well for generating the initial structure of a component, API route, or Dockerfile. Always review the output critically — you're the architect, Claude is the drafter.

**Iterate in small increments.** Rather than asking for the whole app at once, work one requirement at a time. This makes it easier to catch issues early and keeps Claude's output focused.
