import { Router } from 'express'
import passport from '../auth/passport.js'

const router = Router()
const authMode = process.env.AUTH_MODE || 'local'

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
  router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err)
      if (!user) return res.status(401).json({ error: info?.message || 'Login failed.' })
      req.logIn(user, (err) => {
        if (err) return next(err)
        const { id, display_name, email, is_admin } = user
        res.json({ id, display_name, email, is_admin: Boolean(is_admin) })
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
    passport.authenticate('google', { failureRedirect: '/login?error=oauth' }),
    (req, res) => {
      const next = req.query.next || '/gallery'
      // Basic open-redirect guard — only allow relative paths
      const safePath = next.startsWith('/') ? next : '/gallery'
      res.redirect(safePath)
    }
  )
}

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err)
    res.json({ message: 'Logged out.' })
  })
})

export default router
