import { runSchema, runMigrations } from './schema.js'
import { runSeed } from './seed.js'

export function initDatabase() {
  runSchema()
  runMigrations()
  runSeed()
}

export { default as db } from './database.js'
