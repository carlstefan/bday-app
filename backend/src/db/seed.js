import bcrypt from 'bcrypt'
import db from './database.js'

const BCRYPT_ROUNDS = 12

// Dev test users — only seeded when AUTH_MODE !== 'google'
const TEST_USERS = [
  {
    username: 'cs',
    display_name: 'Carl Stefan Grøtter',
    email: 'cs@example.com',
    is_admin: 1,
    password: 'cs1234',
  },
  {
    username: 'trude',
    display_name: 'Trude Dale Sivertsen',
    email: 'trude@example.com',
    is_admin: 1,
    password: 'trude1234',
  },
  {
    username: 'preben',
    display_name: 'Preben Refsum Grøtter',
    email: 'preben@example.com',
    is_admin: 0,
    password: 'preben1234',
  },
  {
    username: 'marita',
    display_name: 'Marita Grøtter Raaholt',
    email: 'marita@example.com',
    is_admin: 0,
    password: 'marita1234',
  },
]

export function runSeed() {
  if (process.env.AUTH_MODE === 'google') {
    console.log('Seed: AUTH_MODE=google — skipping local test users.')
    return
  }

  const insert = db.prepare(`
    INSERT INTO users (username, display_name, email, is_admin, password_hash)
    VALUES (@username, @display_name, @email, @is_admin, @password_hash)
  `)
  const exists = db.prepare('SELECT id FROM users WHERE username = ?')

  let seeded = 0
  for (const user of TEST_USERS) {
    if (exists.get(user.username)) {
      continue // idempotent — skip existing users
    }
    const password_hash = bcrypt.hashSync(user.password, BCRYPT_ROUNDS)
    insert.run({ ...user, password_hash })
    seeded++
  }

  if (seeded > 0) {
    console.log(`Seed: inserted ${seeded} test user(s).`)
  } else {
    console.log('Seed: all test users already exist — nothing to do.')
  }
}
