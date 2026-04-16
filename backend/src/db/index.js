import { runSchema } from './schema.js'
import { runSeed } from './seed.js'

export function initDatabase() {
  runSchema()
  runSeed()
}

export { default as db } from './database.js'
