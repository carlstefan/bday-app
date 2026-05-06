#!/usr/bin/env node
/**
 * One-time migration: single-party → multi-party.
 *
 * Run manually once after deploying the multi-party codebase:
 *   node scripts/migrate-to-multiparty.js
 *
 * The script is idempotent — it checks for the `parties` table before
 * proceeding and exits cleanly if the migration has already been applied.
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DB_PATH      = process.env.DB_PATH      || path.join(__dirname, '../data/db.sqlite')
const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads')

function log(msg) {
  console.log(`[migrate] ${msg}`)
}

function fail(msg) {
  console.error(`[migrate] FATAL: ${msg}`)
  process.exit(1)
}

// ── Open DB ────────────────────────────────────────────────────────────────
log(`Opening database: ${DB_PATH}`)
let db
try {
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
} catch (err) {
  fail(`Cannot open database: ${err.message}`)
}

// ── Idempotency check ──────────────────────────────────────────────────────
const partiesExists = db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name='parties'`
).get()

if (partiesExists) {
  log('parties table already exists — migration has already been applied. Exiting.')
  process.exit(0)
}

log('Starting multi-party migration…')

// ── Schema changes (single transaction) ───────────────────────────────────
log('Step 1: Applying schema changes…')
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parties (
      id                        INTEGER PRIMARY KEY AUTOINCREMENT,
      party_key                 TEXT    NOT NULL UNIQUE,
      name                      TEXT    NOT NULL,
      description               TEXT    NOT NULL DEFAULT '',
      submissions_open          INTEGER NOT NULL DEFAULT 1,
      anonymous_uploads_enabled INTEGER NOT NULL DEFAULT 1,
      is_promoted               INTEGER NOT NULL DEFAULT 0,
      featured_photo_id         INTEGER,
      created_at                TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS party_roles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      party_id    INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      role        TEXT    NOT NULL CHECK(role IN ('owner', 'manager', 'guest')),
      granted_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, party_id)
    );

    CREATE TABLE IF NOT EXISTS bans (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      party_id   INTEGER REFERENCES parties(id) ON DELETE CASCADE,
      reason     TEXT,
      banned_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const userCols = db.prepare('PRAGMA table_info(users)').all()
  if (!userCols.some(c => c.name === 'is_super_admin')) {
    db.exec('ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0')
    log('  Added is_super_admin column to users')
  }

  const photoCols = db.prepare('PRAGMA table_info(photos)').all()
  if (!photoCols.some(c => c.name === 'party_id')) {
    db.exec('ALTER TABLE photos ADD COLUMN party_id INTEGER REFERENCES parties(id)')
    log('  Added party_id column to photos')
  }
} catch (err) {
  fail(`Schema changes failed: ${err.message}`)
}
log('Step 1 complete.')

// ── Insert tcs party ───────────────────────────────────────────────────────
log('Step 2: Inserting tcs party record…')
let tcsId
try {
  const result = db.prepare(`
    INSERT INTO parties (party_key, name, description, submissions_open, anonymous_uploads_enabled, is_promoted)
    VALUES ('tcs', 'Trude og Carl Stefans 100-årsdag',
      'Trude og Carl Stefan fyller begge 50 år i år, og dette vil vi feire med dere. Vi håper dere tar mange kule bilder og deler dem med oss gjennom denne siden!',
      1, 1, 1)
  `).run()
  tcsId = result.lastInsertRowid
  log(`  Inserted tcs party with id=${tcsId}`)
} catch (err) {
  fail(`Failed to insert tcs party: ${err.message}`)
}

// ── Assign all existing photos to tcs ─────────────────────────────────────
log('Step 3: Assigning all existing photos to tcs party…')
try {
  const { changes } = db.prepare('UPDATE photos SET party_id = ? WHERE party_id IS NULL').run(tcsId)
  log(`  Updated ${changes} photo(s)`)
} catch (err) {
  fail(`Failed to assign photos: ${err.message}`)
}

// ── Move files on disk ─────────────────────────────────────────────────────
log('Step 4: Moving files to party-scoped subdirectories…')

const tcsUploadsDir   = path.join(UPLOADS_PATH, 'tcs')
const tcsThumbnailsDir = path.join(UPLOADS_PATH, 'thumbnails', 'tcs')

try {
  fs.mkdirSync(tcsUploadsDir,    { recursive: true })
  fs.mkdirSync(tcsThumbnailsDir, { recursive: true })
} catch (err) {
  fail(`Failed to create target directories: ${err.message}`)
}

// Move originals: files in UPLOADS_PATH root (skip directories)
let movedOriginals = 0
let movedThumbnails = 0
let skippedOriginals = 0
let skippedThumbnails = 0

if (fs.existsSync(UPLOADS_PATH)) {
  const rootEntries = fs.readdirSync(UPLOADS_PATH, { withFileTypes: true })
  for (const entry of rootEntries) {
    if (!entry.isFile()) continue
    const src  = path.join(UPLOADS_PATH, entry.name)
    const dest = path.join(tcsUploadsDir, entry.name)
    try {
      fs.renameSync(src, dest)
      movedOriginals++
    } catch (err) {
      console.error(`[migrate]   WARN: could not move ${entry.name}: ${err.message}`)
      skippedOriginals++
    }
  }
}
log(`  Originals: moved ${movedOriginals}, skipped ${skippedOriginals}`)

// Move thumbnails: files in UPLOADS_PATH/thumbnails root (skip subdirectories)
const thumbnailsRoot = path.join(UPLOADS_PATH, 'thumbnails')
if (fs.existsSync(thumbnailsRoot)) {
  const thumbEntries = fs.readdirSync(thumbnailsRoot, { withFileTypes: true })
  for (const entry of thumbEntries) {
    if (!entry.isFile()) continue
    const src  = path.join(thumbnailsRoot, entry.name)
    const dest = path.join(tcsThumbnailsDir, entry.name)
    try {
      fs.renameSync(src, dest)
      movedThumbnails++
    } catch (err) {
      console.error(`[migrate]   WARN: could not move thumbnail ${entry.name}: ${err.message}`)
      skippedThumbnails++
    }
  }
}
log(`  Thumbnails: moved ${movedThumbnails}, skipped ${skippedThumbnails}`)

// ── Set Carl Stefan as Super Admin ─────────────────────────────────────────
log('Step 5: Setting carlstefan@gmail.com as Super Admin…')
try {
  const { changes } = db.prepare(
    `UPDATE users SET is_super_admin = 1 WHERE email = 'carlstefan@gmail.com'`
  ).run()
  if (changes === 0) {
    console.warn('[migrate]   WARN: no user found with email carlstefan@gmail.com — is_super_admin not set')
  } else {
    log(`  Set is_super_admin=1 on ${changes} user(s)`)
  }
} catch (err) {
  fail(`Failed to set super admin: ${err.message}`)
}

// ── Grant Trude Party Owner role for tcs ──────────────────────────────────
log('Step 6: Granting Trude Party Owner role for tcs…')
try {
  const trude = db.prepare(
    `SELECT id, display_name, email FROM users WHERE display_name LIKE 'Trude%' ORDER BY id ASC LIMIT 1`
  ).get()
  if (!trude) {
    console.warn('[migrate]   WARN: no user found with display_name starting with "Trude" — Party Owner not assigned')
  } else {
    db.prepare(
      `INSERT OR REPLACE INTO party_roles (user_id, party_id, role) VALUES (?, ?, 'owner')`
    ).run(trude.id, tcsId)
    log(`  Granted owner role to "${trude.display_name}" (id=${trude.id}) for party tcs`)
  }
} catch (err) {
  fail(`Failed to grant Party Owner role: ${err.message}`)
}

log('Migration complete.')
db.close()
