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
      status               TEXT    NOT NULL DEFAULT 'pending',
      resolved_by_user_id  INTEGER REFERENCES users(id),
      resolved_at          TEXT
    );
  `)
}
