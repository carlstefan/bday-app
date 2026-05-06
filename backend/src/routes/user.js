/**
 * User account management — mounted at /api/user
 */
import { Router } from 'express'
import { db } from '../db/index.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { logEvent } from '../services/auditLog.js'
import { z } from 'zod'

const router = Router()

const displayNameSchema = z.object({
  display_name: z.string().min(1).max(60).trim(),
})

// ── PATCH /api/user/display-name ──────────────────────────────────────────
router.patch('/display-name', requireAuth, (req, res) => {
  const parse = displayNameSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message })

  const oldName = req.user.display_name
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(parse.data.display_name, req.user.id)

  logEvent('display_name_change', req.user.id, req.ip, { old_name: oldName, new_name: parse.data.display_name })
  res.json({ display_name: parse.data.display_name })
})

// ── DELETE /api/user ──────────────────────────────────────────────────────
// Delete account: photos remain (user_id set to NULL), roles/bans cascade.
router.delete('/', requireAuth, (req, res, next) => {
  const userId = req.user.id

  db.transaction(() => {
    db.prepare('UPDATE photos SET user_id = NULL WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  })()

  logEvent('account_delete', userId, req.ip, { display_name: req.user.display_name })

  req.logout((err) => {
    if (err) return next(err)
    req.session.destroy(() => {
      res.clearCookie('connect.sid')
      res.json({ message: 'Account deleted.' })
    })
  })
})

export default router
