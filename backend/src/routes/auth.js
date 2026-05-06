import { Router } from 'express'
import passport from '../auth/passport.js'
import { loginLimiter } from '../middleware/rateLimiter.js'
import { loginSchema } from '../schemas/auth.js'
import { logEvent } from '../services/auditLog.js'
import { db } from '../db/index.js'

const router = Router()
const authMode = process.env.AUTH_MODE || 'local'

// TR-S17: Reject protocol-relative and backslash-relative paths
function isSafePath(p) {
  if (typeof p !== 'string') return false
  if (!p.startsWith('/')) return false
  if (p.startsWith('//')) return false
  if (p.startsWith('/\\')) return false
  if (p.includes(':')) return false
  return true
}

// ── GET /api/auth/mode ──────────────────────────────────────────────────────
router.get('/mode', (_req, res) => {
  res.json({ mode: authMode })
})

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated.' })

  const { id, display_name, email, is_admin, is_super_admin } = req.user

  // Include party roles so the frontend knows the user's roles across parties
  const partyRoles = db.prepare(
    `SELECT pr.party_id, pr.role, p.party_key, p.name AS party_name
     FROM party_roles pr
     JOIN parties p ON p.id = pr.party_id
     WHERE pr.user_id = ?`
  ).all(id)

  res.json({
    id,
    display_name,
    email,
    is_admin: Boolean(is_admin),
    is_super_admin: Boolean(is_super_admin),
    party_roles: partyRoles,
  })
})

// ── POST /api/auth/login (local only) ──────────────────────────────────────
if (authMode === 'local') {
  router.post('/login', loginLimiter, (req, res, next) => {
    const parse = loginSchema.safeParse(req.body)
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid username or password.' })
    }
    req.body = parse.data
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err)
      if (!user) {
        logEvent('login', null, req.ip, { method: 'local', success: false, username: parse.data.username })
        return res.status(401).json({ error: info?.message || 'Login failed.' })
      }
      // C3: Regenerate session before binding user
      req.session.regenerate((err) => {
        if (err) return next(err)
        req.logIn(user, (err) => {
          if (err) return next(err)
          logEvent('login', user.id, req.ip, { method: 'local', success: true })
          const { id, display_name, email, is_admin, is_super_admin } = user
          const partyRoles = db.prepare(
            `SELECT pr.party_id, pr.role, p.party_key, p.name AS party_name
             FROM party_roles pr JOIN parties p ON p.id = pr.party_id WHERE pr.user_id = ?`
          ).all(id)
          res.json({ id, display_name, email, is_admin: Boolean(is_admin), is_super_admin: Boolean(is_super_admin), party_roles: partyRoles })
        })
      })
    })(req, res, next)
  })
}

// ── Google OAuth routes (production only) ──────────────────────────────────
if (authMode === 'google') {
  // TR-S17: Store the `next` param in session before handing off to Google,
  // so it survives the OAuth round-trip even though query params are lost.
  router.get('/google', (req, res, next) => {
    const next_ = req.query.next
    if (next_ && isSafePath(next_)) {
      req.session.oauthReturnTo = next_
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
  })

  router.get(
    '/google/callback',
    (req, res, next) => {
      passport.authenticate('google', (err, user) => {
        if (err) return next(err)
        if (!user) return res.redirect('/login?error=oauth')
        // C3: Regenerate session before binding user
        req.session.regenerate((err) => {
          if (err) return next(err)
          req.logIn(user, (err) => {
            if (err) return next(err)
            // Restore returnTo from session (set before Google redirect)
            const dest = req.session.oauthReturnTo || '/'
            delete req.session.oauthReturnTo
            res.redirect(isSafePath(dest) ? dest : '/')
          })
        })
      })(req, res, next)
    }
  )
}

// ── POST /api/auth/logout ───────────────────────────────────────────────────
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
