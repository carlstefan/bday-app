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
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      filename      TEXT    NOT NULL,
      original_name TEXT    NOT NULL,
      uploader_name TEXT,
      caption       TEXT,
      user_id       INTEGER REFERENCES users(id),
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
  const cols = db.prepare('PRAGMA table_info(deletion_requests)').all()
  if (!cols.some((c) => c.name === 'is_own_photo')) {
    db.exec('ALTER TABLE deletion_requests ADD COLUMN is_own_photo INTEGER NOT NULL DEFAULT 0')
    console.log('Migration: added is_own_photo to deletion_requests')
  }

  // ── TR-D05: rename old status values ────────────────────────────────────
  //   accepted → deleted  |  denied → rejected  |  leave-hidden → hidden
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
}
