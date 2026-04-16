// Entry point — will be expanded in Phase 3
import express from 'express'

const app = express()
const port = process.env.PORT || 3001

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend listening on port ${port}`)
})
