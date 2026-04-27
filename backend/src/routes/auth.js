import { Router } from 'express'
import passport from '../auth/passport.js'
import { loginLimiter } from '../middleware/rateLimiter.js'
import { loginSchema } from '../schemas/auth.js'
import { logEvent } from '../services/auditLog.js'

const router = Router()
const authMode = process.env.AUTH_MODE || 'local'

// H1: Reject protocol-relative and backslash-relative paths that browsers
// resolve as external URLs (e.g. //evil.com, /\evil.com).
function isSafePath(p) {
  return (
    typeof p === 'string' &&
    p.startsWith('/') &&
    !p.startsWith('//') &&
    !p.startsWith('/\\')
  )
}

// ── GET /api/auth/mode ──────────────────────────────────────────────────────
// Tells the frontend which login UI to show
router.get('/mode', (_req, res) => {
  res.json({ mode: authMode })
})

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated.' })
  const { id, display_name, email, is_admin } = req.user
  res.json({ id, display_name, email, is_admin: Boolean(is_admin) })
})

// ── POST /api/auth/login (local only) ──────────────────────────────────────
if (authMode === 'local') {
  router.post('/login', loginLimiter, (req, res, next) => {
    const parse = loginSchema.safeParse(req.body)
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid username or password.' })
    }
    // Replace req.body with sanitised values so Passport reads them
    req.body = parse.data
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err)
      if (!user) {
        logEvent('login', null, req.ip, { method: 'local', success: false, username: parse.data.username })
        return res.status(401).json({ error: info?.message || 'Login failed.' })
      }
      // C3: Regenerate session ID before binding the user to prevent fixation
      req.session.regenerate((err) => {
        if (err) return next(err)
        req.logIn(user, (err) => {
          if (err) return next(err)
          logEvent('login', user.id, req.ip, { method: 'local', success: true })
          const { id, display_name, email, is_admin } = user
          res.json({ id, display_name, email, is_admin: Boolean(is_admin) })
        })
      })
    })(req, res, next)
  })
}

// ── Google OAuth routes (production only) ──────────────────────────────────
if (authMode === 'google') {
  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  )

  router.get(
    '/google/callback',
    // Use custom callback so we can regenerate the session before binding the user (C3)
    (req, res, next) => {
      passport.authenticate('google', (err, user) => {
        if (err) return next(err)
        if (!user) return res.redirect('/login?error=oauth')
        // C3: Regenerate session ID before binding the authenticated user
        req.session.regenerate((err) => {
          if (err) return next(err)
          req.logIn(user, (err) => {
            if (err) return next(err)
            const dest = req.query.next || '/gallery'
            // H1: Reject protocol-relative paths (//evil.com)
            res.redirect(isSafePath(dest) ? dest : '/gallery')
          })
        })
      })(req, res, next)
    }
  )
}

// ── POST /api/auth/logout ───────────────────────────────────────────────────
// C4: Destroy the session server-side and clear the cookie so a captured
// cookie cannot be replayed after logout.
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err)
    req.session.destroy((err) => {
      if (err) return next(err)
      res.clearCookie('connect.sid')
      res.json({ message: 'Logged out.' })
    })
  })
})

export default router
