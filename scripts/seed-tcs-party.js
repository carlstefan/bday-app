import Database from 'better-sqlite3'
const db = new Database('/app/data/db.sqlite')

const existing = db.prepare('SELECT id FROM parties WHERE party_key = ?').get('tcs')
if (existing) {
  console.log('tcs party already exists, id:', existing.id)
  // Still assign photos that are unassigned
  const updated = db.prepare('UPDATE photos SET party_id = ? WHERE party_id IS NULL').run(existing.id)
  console.log('Photos newly assigned to tcs:', updated.changes)
  process.exit(0)
}

const result = db.prepare(
  'INSERT INTO parties (party_key, name, description, submissions_open, anonymous_uploads_enabled, is_promoted) VALUES (?, ?, ?, 1, 1, 1)'
).run(
  'tcs',
  'Trude og Carl Stefans 100-årsdag',
  'Trude og Carl Stefan fyller begge 50 år i år, og dette vil vi feire med dere. Vi håper dere tar mange kule bilder og deler dem med oss gjennom denne siden!'
)

const partyId = result.lastInsertRowid
console.log('Inserted tcs party, id:', partyId)

const updated = db.prepare('UPDATE photos SET party_id = ? WHERE party_id IS NULL').run(partyId)
console.log('Photos assigned to tcs:', updated.changes)

const sa = db.prepare("UPDATE users SET is_super_admin = 1 WHERE email = 'carlstefan@gmail.com'").run()
console.log('Super admin set:', sa.changes, 'row(s)')

const trude = db.prepare("SELECT id FROM users WHERE display_name LIKE 'Trude%'").get()
if (trude) {
  db.prepare('INSERT OR IGNORE INTO party_roles (user_id, party_id, role) VALUES (?, ?, ?)').run(trude.id, partyId, 'owner')
  console.log('Trude granted owner role')
} else {
  console.log('Trude user not found')
}

console.log('Done.')
