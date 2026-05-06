/**
 * Party management API — mounted at /api/parties
 * Covers create/list/update parties, roles, bans, featured photo.
 */
import { Router } from 'express'
import { db } from '../db/index.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { resolveParty } from '../middleware/resolveParty.js'
import { requirePartyRole, userHasPartyRole } from '../middleware/requirePartyRole.js'
import { logEvent } from '../services/auditLog.js'
import { z } from 'zod'

const router = Router()

function requireSuperAdmin(req, res, next) {
  if (!req.user?.is_super_admin) return res.status(403).json({ error: 'Super Admin only.' })
  next()
}

const partyKeySchema = z.string().regex(/^[a-z0-9]+$/, 'Party key must be lowercase letters and numbers only')

const createPartySchema = z.object({
  party_key:   partyKeySchema.min(2).max(32),
  name:        z.string().min(1).max(120),
  description: z.string().max(500).default(''),
})

const updatePartySchema = z.object({
  name:                      z.string().min(1).max(120).optional(),
  description:               z.string().max(500).optional(),
  submissions_open:          z.boolean().optional(),
  anonymous_uploads_enabled: z.boolean().optional(),
  is_promoted:               z.boolean().optional(),
  featured_photo_id:         z.number().int().positive().nullable().optional(),
})

const grantRoleSchema = z.object({
  user_id: z.number().int().positive(),
  role:    z.enum(['owner', 'manager', 'guest']),
})

const banSchema = z.object({
  user_id:  z.number().int().positive(),
  reason:   z.string().max(200).optional(),
})

const idParam = z.object({ id: z.coerce.number().int().positive() })
const userIdParam = z.object({ userId: z.coerce.number().int().positive() })

// ── GET /api/parties ─────────────────────────────────────────────────────
// List all parties. Super Admin only for full list; public gets promoted only.
router.get('/', requireAuth, requireSuperAdmin, (_req, res) => {
  const parties = db.prepare('SELECT * FROM parties ORDER BY created_at ASC').all()
  res.json({ parties })
})

// ── GET /api/parties/public ──────────────────────────────────────────────
// Public: list all parties (basic fields, for party switcher etc.)
router.get('/public', (_req, res) => {
  const parties = db.prepare(
    'SELECT id, party_key, name, description, submissions_open, is_promoted, featured_photo_id FROM parties ORDER BY created_at ASC'
  ).all()
  res.json({ parties })
})

// ── POST /api/parties ────────────────────────────────────────────────────
router.post('/', requireAuth, requireSuperAdmin, (req, res) => {
  const parse = createPartySchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message })

  const { party_key, name, description } = parse.data

  const existing = db.prepare('SELECT id FROM parties WHERE party_key = ?').get(party_key)
  if (existing) return res.status(409).json({ error: 'A party with this key already exists.' })

  const result = db.prepare(
    `INSERT INTO parties (party_key, name, description) VALUES (?, ?, ?)`
  ).run(party_key, name, description)

  const party = db.prepare('SELECT * FROM parties WHERE id = ?').get(result.lastInsertRowid)
  logEvent('party_create', req.user.id, req.ip, { party_key, name })
  res.status(201).json({ party })
})

// ── Routes below use :partyKey param — apply resolveParty ────────────────
const partyRouter = Router({ mergeParams: true })
partyRouter.use(resolveParty)

// ── GET /api/parties/:partyKey ───────────────────────────────────────────
partyRouter.get('/', (req, res) => {
  res.json({ party: req.party })
})

// ── PATCH /api/parties/:partyKey ─────────────────────────────────────────
partyRouter.patch('/', requireAuth, (req, res) => {
  const party = req.party
  const isOwnerOrAdmin = req.user.is_super_admin || userHasPartyRole(req.user, party, 'owner')
  if (!isOwnerOrAdmin) return res.status(403).json({ error: 'Owner or Super Admin only.' })

  const parse = updatePartySchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message })

  const fields = parse.data

  // Enforce single promoted party
  if (fields.is_promoted === true) {
    db.prepare('UPDATE parties SET is_promoted = 0').run()
  }

  const setClauses = []
  const values = []
  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined) continue
    setClauses.push(`${key} = ?`)
    values.push(typeof val === 'boolean' ? (val ? 1 : 0) : val)
  }

  if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update.' })
  values.push(party.id)

  db.prepare(`UPDATE parties SET ${setClauses.join(', ')} WHERE id = ?`).run(...values)

  const updated = db.prepare('SELECT * FROM parties WHERE id = ?').get(party.id)
  res.json({ party: updated })
})

// ── GET /api/parties/:partyKey/users ─────────────────────────────────────
partyRouter.get('/users', requireAuth, (req, res) => {
  const isOwnerOrAdmin = req.user.is_super_admin || userHasPartyRole(req.user, req.party, 'owner')
  if (!isOwnerOrAdmin) return res.status(403).json({ error: 'Owner or Super Admin only.' })

  const members = db.prepare(`
    SELECT u.id, u.display_name, u.email, pr.role, pr.created_at AS role_granted_at
    FROM party_roles pr
    JOIN users u ON u.id = pr.user_id
    WHERE pr.party_id = ?
    ORDER BY pr.created_at ASC
  `).all(req.party.id)
  res.json({ members })
})

// ── POST /api/parties/:partyKey/roles ─────────────────────────────────────
partyRouter.post('/roles', requireAuth, (req, res) => {
  const isOwnerOrAdmin = req.user.is_super_admin || userHasPartyRole(req.user, req.party, 'owner')
  if (!isOwnerOrAdmin) return res.status(403).json({ error: 'Owner or Super Admin only.' })

  const parse = grantRoleSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message })

  const { user_id, role } = parse.data
  const target = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(user_id)
  if (!target) return res.status(404).json({ error: 'User not found.' })

  db.prepare(
    `INSERT INTO party_roles (user_id, party_id, role, granted_by) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, party_id) DO UPDATE SET role = excluded.role, granted_by = excluded.granted_by`
  ).run(user_id, req.party.id, role, req.user.id)

  logEvent('role_grant', req.user.id, req.ip, { target_user_id: user_id, party_key: req.party.party_key, role })
  res.status(201).json({ message: `Granted ${role} to ${target.display_name}.` })
})

// ── DELETE /api/parties/:partyKey/roles/:userId ───────────────────────────
partyRouter.delete('/roles/:userId', requireAuth, (req, res) => {
  const isOwnerOrAdmin = req.user.is_super_admin || userHasPartyRole(req.user, req.party, 'owner')
  if (!isOwnerOrAdmin) return res.status(403).json({ error: 'Owner or Super Admin only.' })

  const parse = userIdParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid user ID.' })

  const { changes } = db.prepare(
    'DELETE FROM party_roles WHERE user_id = ? AND party_id = ?'
  ).run(parse.data.userId, req.party.id)

  if (changes === 0) return res.status(404).json({ error: 'Role not found.' })

  logEvent('role_revoke', req.user.id, req.ip, { target_user_id: parse.data.userId, party_key: req.party.party_key })
  res.json({ message: 'Role revoked.' })
})

// ── POST /api/parties/:partyKey/bans ─────────────────────────────────────
partyRouter.post('/bans', requireAuth, (req, res) => {
  const isManagerOrAbove = req.user.is_super_admin || userHasPartyRole(req.user, req.party, 'manager')
  if (!isManagerOrAbove) return res.status(403).json({ error: 'Manager or above only.' })

  const parse = banSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message })

  const { user_id, reason } = parse.data
  db.prepare(
    'INSERT INTO bans (user_id, party_id, reason, banned_by) VALUES (?, ?, ?, ?)'
  ).run(user_id, req.party.id, reason || null, req.user.id)

  logEvent('ban_user', req.user.id, req.ip, { target_user_id: user_id, party_key: req.party.party_key, reason })
  res.status(201).json({ message: 'User banned from this party.' })
})

// ── PATCH /api/parties/:partyKey/featured-photo ────────────────────────────
partyRouter.patch('/featured-photo', requireAuth, (req, res) => {
  const isOwnerOrAdmin = req.user.is_super_admin || userHasPartyRole(req.user, req.party, 'owner')
  if (!isOwnerOrAdmin) return res.status(403).json({ error: 'Owner or Super Admin only.' })

  const parse = z.object({ photo_id: z.number().int().positive().nullable() }).safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo_id.' })

  const photoId = parse.data.photo_id
  if (photoId !== null) {
    const photo = db.prepare('SELECT id FROM photos WHERE id = ? AND party_id = ?').get(photoId, req.party.id)
    if (!photo) return res.status(404).json({ error: 'Photo not found in this party.' })
  }

  db.prepare('UPDATE parties SET featured_photo_id = ? WHERE id = ?').run(photoId, req.party.id)
  res.json({ message: 'Featured photo updated.' })
})

// ── POST /api/parties/bans — global ban (Super Admin only) ──────────────
// Must be before router.use('/:partyKey') so Express doesn't interpret 'bans' as a partyKey
router.post('/bans', requireAuth, requireSuperAdmin, (req, res) => {
  const parse = banSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message })

  const { user_id, reason } = parse.data
  db.prepare(
    'INSERT INTO bans (user_id, party_id, reason, banned_by) VALUES (?, NULL, ?, ?)'
  ).run(user_id, reason || null, req.user.id)

  logEvent('ban_user', req.user.id, req.ip, { target_user_id: user_id, global: true, reason })
  res.status(201).json({ message: 'User globally banned.' })
})

// Mount party sub-router (must be last to avoid eating literal route segments)
router.use('/:partyKey', partyRouter)

export default router
