import { initDatabase } from './db/index.js'

// Bootstrap database (schema + seed) before starting the server
initDatabase()

// App is defined in app.js — imported after DB is ready
const { default: app } = await import('./app.js')

const port = process.env.PORT || 3001
app.listen(port, '0.0.0.0', () => {
  console.log(`Backend listening on port ${port} (AUTH_MODE=${process.env.AUTH_MODE || 'local'})`)
})
