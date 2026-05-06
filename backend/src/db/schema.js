import db from './database.js'

export function runSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id     TEXT    UNIQUE,
      username      TEXT    UNIQUE,
      password_hash TEXT,
      display_name  TEXT    NOT NULL,
      email         TEXT,
      is_admin      INTEGER NOT NULL DEFAULT 0,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

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

    CREATE TABLE IF NOT EXISTS photos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      filename      TEXT    NOT NULL,
      original_name TEXT    NOT NULL,
      uploader_name TEXT,
      caption       TEXT,
      user_id       INTEGER REFERENCES users(id),
      party_id      INTEGER REFERENCES parties(id),
      is_hidden     INTEGER NOT NULL DEFAULT 0,
      captured_at   TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deletion_requests (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_id             INTEGER NOT NULL REFERENCES photos(id),
      flagged_by_user_id   INTEGER NOT NULL REFERENCES users(id),
      flagged_at           TEXT    NOT NULL DEFAULT (datetime('now')),
      is_own_photo         INTEGER NOT NULL DEFAULT 0,
      status               TEXT    NOT NULL DEFAULT 'pending',
      resolved_by_user_id  INTEGER REFERENCES users(id),
      resolved_at          TEXT
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

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type  TEXT    NOT NULL,
      user_id     INTEGER REFERENCES users(id),
      ip_address  TEXT,
      metadata    TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

/**
 * Idempotent migrations — run after runSchema() on every startup.
 * Safe to run on both fresh and existing databases.
 */
export function runMigrations() {
  // ── TR-D05: add is_own_photo column if missing (existing DBs) ───────────
  const drCols = db.prepare('PRAGMA table_info(deletion_requests)').all()
  if (!drCols.some((c) => c.name === 'is_own_photo')) {
    db.exec('ALTER TABLE deletion_requests ADD COLUMN is_own_photo INTEGER NOT NULL DEFAULT 0')
    console.log('Migration: added is_own_photo to deletion_requests')
  }

  // ── TR-D05: rename old status values ────────────────────────────────────
  const renames = [
    "UPDATE deletion_requests SET status = 'deleted'  WHERE status = 'accepted'",
    "UPDATE deletion_requests SET status = 'rejected' WHERE status = 'denied'",
    "UPDATE deletion_requests SET status = 'hidden'   WHERE status IN ('leave-hidden','left_hidden','left-hidden')",
  ]
  for (const sql of renames) {
    const { changes } = db.prepare(sql).run()
    if (changes > 0) console.log(`Migration: ${sql.trim()} → ${changes} row(s)`)
  }

  // ── TR-D07: audit_log table (idempotent guard for pre-migration DBs) ────
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type  TEXT    NOT NULL,
      user_id     INTEGER REFERENCES users(id),
      ip_address  TEXT,
      metadata    TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // ── Multi-party: add is_super_admin to users if missing ─────────────────
  const userCols = db.prepare('PRAGMA table_info(users)').all()
  if (!userCols.some((c) => c.name === 'is_super_admin')) {
    db.exec('ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0')
    console.log('Migration: added is_super_admin to users')
  }

  // ── Multi-party: add party_id to photos if missing ───────────────────────
  const photoCols = db.prepare('PRAGMA table_info(photos)').all()
  if (!photoCols.some((c) => c.name === 'party_id')) {
    db.exec('ALTER TABLE photos ADD COLUMN party_id INTEGER REFERENCES parties(id)')
    console.log('Migration: added party_id to photos')
  }

  // ── Multi-party: create parties table if missing ─────────────────────────
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
    )
  `)

  // ── Multi-party: create party_roles table if missing ────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS party_roles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      party_id    INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      role        TEXT    NOT NULL CHECK(role IN ('owner', 'manager', 'guest')),
      granted_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, party_id)
    )
  `)

  // ── Multi-party: create bans table if missing ────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS bans (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      party_id   INTEGER REFERENCES parties(id) ON DELETE CASCADE,
      reason     TEXT,
      banned_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
}
