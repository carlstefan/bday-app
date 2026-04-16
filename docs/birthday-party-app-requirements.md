# Birthday Party Photo App — Requirements

**Project:** Carl Stefan & Trude's 50th Birthday Party Photo Submission App  
**Status:** Draft  
**Last updated:** 2026-04-16 (v3)  

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
- An edit icon is visible on each photo in the gallery that belongs to the logged-in user
- The user can update the caption (max 200 characters) and save it
- The updated caption is reflected in the gallery immediately
- Users can only edit captions on their own photos — not on photos uploaded by others or anonymously
- Anonymous uploads cannot be edited (no user association to verify ownership)

---

### 3.3 Authenticated Guest — Gallery

Gallery access is restricted to logged-in users. All gallery views display only non-hidden, non-flagged photos, sorted by EXIF capture time (`DateTimeOriginal`), falling back to upload time if EXIF is unavailable. Hidden and flagged photos are invisible to guests in all views.

---

**FR-G04 — Gallery: portrait phone view**  
*Priority: Must*

> As a guest on a phone held in portrait orientation, I want an immersive single-photo experience with easy access to a thumbnail overview, so that I can browse photos naturally on a small screen.

Acceptance criteria:
- On screens narrower than 480px CSS width, or a phone in portrait orientation, the default gallery view shows one photo at a time filling the screen, rendered using the 1000px thumbnail
- Swiping left or right navigates to the previous or next photo
- A subtle icon indicates that rotating the phone to landscape will give a richer view
- Swiping down transitions to a thumbnail grid showing 6 photos at a time in a 2-column × 3-row layout; swiping up/down scrolls through additional photos
- Tapping a thumbnail in the grid transitions to the single-photo view for that photo
- Tapping the photo in single-photo view opens the full-screen view (FR-G06)

---

**FR-G05 — Gallery: sushi bar view**  
*Priority: Must*

> As a guest on a larger screen, I want to see a focused carousel centred on one photo with neighbouring photos visible, so that I have context and can navigate fluidly.

Acceptance criteria:
- The sushi bar is the default gallery view for screens 480px CSS width and above
- The number of visible photos depends on viewport width: 3 images on landscape phones (480–767px), 5 images on tablets and small screens (768–1279px), 7 images on wide screens (1280px and above)
- The centre image is displayed significantly larger than the flanking images
- The centre image is rendered using the 1000px thumbnail on screens below 1024px; the full original image is used on screens 1024px and above
- Flanking images are always rendered using the 1000px thumbnail
- Navigation — touch: swipe left/right; keyboard: left/right arrow keys; mouse: click a flanking image or scroll wheel (scroll wheel advances through photos, there is no vertical page scroll in this view)
- The view occupies the full viewport — no content exists above or below to scroll to
- The uploader name and caption are displayed alongside the centre image (e.g. below or as a subtle overlay); flanking images show no text
- Tapping or clicking the centre image opens the full-screen view (FR-G06)
- On screens 1024px and above, a toggle button (grid icon) switches to the gallery grid view (FR-G07); the selected view is remembered for the session

---

**FR-G06 — Gallery: full-screen view**  
*Priority: Must*

> As a guest, I want to view a photo at full quality filling my entire screen, with the ability to zoom in and swipe through photos, so that I can appreciate the details.

Acceptance criteria:
- The full-screen view is always entered by tapping/clicking the centre image in the sushi bar or a photo in the portrait phone single-photo view
- The full original image is always loaded regardless of screen size
- The image fills the entire screen with no UI chrome except a minimal close/back control — no uploader name or caption is shown, keeping the view clean for inspecting the image
- Navigation — touch: swipe left/right to move to the previous/next photo; keyboard: left/right arrow keys; mouse: scroll wheel zooms (does not navigate)
- Zooming — touch: pinch to zoom in/out; mouse: scroll wheel zooms in/out
- When the image is zoomed in beyond 1×, swiping or dragging pans the image rather than navigating to the next photo; navigation resumes when zoom returns to 1×
- Dismissing the full-screen view — touch: swipe down or tap the close control; keyboard: Escape; mouse: click the close control — returns the user to the view they came from, at the same photo position

---

**FR-G07 — Gallery: large-screen grid view**  
*Priority: Should*

> As a guest on a large screen, I want to see as many photos as possible at once in a grid, so that I can get an overview of all the party photos and jump to one that catches my eye.

Acceptance criteria:
- Available on screens 1024px and above as a toggle alternative to the sushi bar view
- The grid fills the viewport with as many thumbnail columns and rows as fit naturally for the screen width; the number of columns is not fixed — it should feel balanced for the screen (e.g. approximately 4–6 columns on a 1024px screen, more on wider screens)
- Thumbnails are rendered using the 1000px thumbnail
- The scroll wheel scrolls the page normally up and down through the full photo collection
- Tapping or clicking a thumbnail transitions to the sushi bar view (FR-G05) centred on the selected photo
- The toggle button switches back to the sushi bar view; the selected view is remembered for the session

---

**FR-G08 — Flag a photo for deletion**  
*Priority: Should*

> As a logged-in guest, I want to flag a photo for deletion, so that I can request removal of a photo I find inappropriate or that I don't want to appear in the gallery.

Acceptance criteria:
- Any logged-in user can flag any photo for deletion (not limited to their own uploads)
- Flagging immediately hides the photo from all non-admin users
- The flagged photo remains visible to admins in a dedicated moderation view, marked as pending deletion
- The user who flagged the photo receives a confirmation that it has been hidden pending admin review
- A photo can only be flagged once — if already flagged, the option is not shown

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

**FR-A02 — Moderate deletion requests**  
*Priority: Should*

> As an admin, I want to review photos that have been flagged for deletion, so that I can decide whether to permanently delete them or restore them to the gallery.

Acceptance criteria:
- A dedicated admin view lists all photos currently flagged for deletion, with the uploader name, caption, flag timestamp, and the name of the user who flagged it
- For each flagged photo, the admin can choose one of three actions:
  - **Accept deletion** — permanently deletes the image file and database record
  - **Deny deletion** — removes the flag and restores the photo to full visibility in the gallery
  - **Leave hidden** — dismisses the deletion request but keeps the photo hidden from guests (equivalent to an admin hide)
- Each action requires a single click and takes effect immediately

---

**FR-A03 — Download all photos**  
*Priority: Should*

> As an admin, I want to download all submitted photos as a zip archive, so that I can keep them after the party.

Acceptance criteria:
- Admin can trigger a download of all photos (including hidden ones, excluding permanently deleted ones) as a single `.zip` file
- Filenames in the archive follow the pattern `YYYYMMDD_HHMMSS_[uploader_name].jpg`
- Each image in the archive has the uploader name and caption embedded as IPTC metadata, so the information travels with the file independently of the database

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

---

### 4.5 Data

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-D01 | SQLite is used as the database, accessed via `better-sqlite3` or Drizzle ORM | Must |
| TR-D02 | The database file is stored on a Docker volume so it persists across container restarts | Must |
| TR-D03 | A `users` table stores: `id`, `google_id` (nullable, populated in Google auth mode only), `username` (nullable, populated in local auth mode only), `password_hash` (nullable, populated in local auth mode only), `display_name`, `email`, `is_admin`, `created_at` | Must |
| TR-D04 | The `photos` table stores: `id`, `filename`, `original_name`, `uploader_name`, `caption`, `user_id` (nullable FK to `users`), `is_hidden`, `captured_at`, `created_at` | Must |
| TR-D05 | A `deletion_requests` table stores: `id`, `photo_id` (FK to `photos`), `flagged_by_user_id` (FK to `users`), `flagged_at`, `status` (`pending` / `accepted` / `denied` / `left_hidden`), `resolved_by_user_id` (nullable FK to `users`), `resolved_at` (nullable) | Must |
| TR-D06 | A seed script runs automatically at application startup when `AUTH_MODE=local`; it checks whether the predefined test users exist and inserts them with bcrypt-hashed passwords if not; the script is idempotent and never executes in Google auth mode | Must |

---

### 4.6 Security & Auth

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-S01 | Authentication is handled via Passport.js with two strategies: `passport-google-oauth20` in production (`AUTH_MODE=google`) and `passport-local` with bcrypt password verification in development (`AUTH_MODE=local`); both strategies produce an identical session, so the rest of the application is unaware of which strategy is active | Must |
| TR-S02 | User sessions are managed via HTTP-only, signed session cookies (e.g. `express-session` with a strong secret) | Must |
| TR-S03 | Admin status is determined by matching the authenticated user's Google email against a list stored in an environment variable (`ADMIN_EMAILS=carl@example.com,trude@example.com`) | Must |
| TR-S04 | Google OAuth credentials (Client ID and Client Secret) are stored as environment variables and never committed to the repository | Must |
| TR-S05 | File type validation is performed server-side by inspecting file headers (magic bytes), not just the MIME type declared by the client; full image decode validation is implicit — thumbnail generation via `sharp` will throw an error if the file cannot be decoded as a valid image, and the upload is rejected at that point with no separate validation step required | Must |
| TR-S06 | The upload endpoint applies rate limiting to prevent abuse (e.g. max 20 uploads per IP per hour) | Should |
| TR-S07 | Uploaded image files are stored with a UUID as the filename (not the original filename); the serving route requires an authenticated session before returning any image file | Must |
| TR-S08 | The `helmet` middleware is applied to all API responses, setting security headers including `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, and `Strict-Transport-Security`; image files are served with the correct `Content-Type` header so the browser never reinterprets them as scripts | Must |
| TR-S09 | Session cookies are configured with `HttpOnly`, `Secure`, and `SameSite=Strict` attributes; sessions expire after a reasonable inactivity period (e.g. 24 hours) | Must |
| TR-S10 | All API request bodies are validated using `zod` schemas before any processing; name and caption fields are additionally stripped of HTML tags server-side before being stored; React's automatic output escaping ensures user-supplied text is never rendered as HTML in the browser | Must |
| TR-S11 | Docker containers run as a non-root user; the uploads and database volumes are mounted only in the backend container; only the Nginx reverse proxy container is reachable from the internet — the backend runs on an internal Docker network with no externally exposed port | Must |
| TR-S12 | `npm audit` is run before deployment and after any dependency updates to check for known vulnerabilities | Should |
| TR-S13 | An `AUTH_MODE` environment variable controls the active authentication strategy: `local` for development (username/password form), `google` for production (Google OAuth); the application defaults to `local` if the variable is not set | Must |

---

### 4.7 Local Development Configuration

When `AUTH_MODE=local`, the following test users are seeded into the database at startup. Passwords are stored as bcrypt hashes — plaintext passwords are defined only in the seed script, which is a development-only file and is never deployed to production.

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

A hero image of Carl Stefan and Trude will be provided at a later stage and incorporated into the front page. A placeholder should be used during development. The front page should immediately communicate the occasion — a shared 50th birthday celebration — and invite guests to upload or sign in.

**Open design decisions**

Specific colour palette, font choices, and component styling are to be decided. These should be informed by the hero photo once available, so the UI and the image feel cohesive rather than mismatched.

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
| OQ-06 | Hero photo of Carl Stefan and Trude for the front page — to be provided when available; colour palette and typography to be chosen once the photo is in hand | Carl Stefan | Open |
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
