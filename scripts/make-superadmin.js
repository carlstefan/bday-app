import Database from 'better-sqlite3'
const db = new Database('/app/data/db.sqlite')
const r = db.prepare("UPDATE users SET is_super_admin = 1 WHERE username = 'cs'").run()
console.log('Updated:', r.changes, 'row(s)')
const u = db.prepare("SELECT id, username, display_name, is_super_admin FROM users WHERE username = 'cs'").get()
console.log(JSON.stringify(u))
