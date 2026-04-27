import { initDatabase } from './db/index.js'

// C2: Refuse to start without a strong SESSION_SECRET
const secret = process.env.SESSION_SECRET
if (!secret || secret.length < 32) {
  console.error('FATAL: SESSION_SECRET must be set and at least 32 characters long.')
  process.exit(1)
}

// Bootstrap database (schema + seed) before starting the server
initDatabase()

// App is defined in app.js — imported after DB is ready
const { default: app } = await import('./app.js')

const port = process.env.PORT || 3001
app.listen(port, '0.0.0.0', () => {
  console.log(`Backend listening on port ${port} (AUTH_MODE=${process.env.AUTH_MODE || 'local'})`)
})
