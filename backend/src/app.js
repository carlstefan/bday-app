import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { sessionMiddleware } from './middleware/session.js'
import passport from './auth/passport.js'
import apiRouter from './routes/index.js'

const app = express()

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet())

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

// ── Session & auth ──────────────────────────────────────────────────────────
app.use(sessionMiddleware)
app.use(passport.initialize())
app.use(passport.session())

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api', apiRouter)

// ── Health check (unauthenticated) ─────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Internal server error.' })
})

export default app
