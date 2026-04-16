import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'db.sqlite')

// Ensure the directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)

// Performance and correctness pragmas
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma("encoding = 'UTF-8'")

export default db
