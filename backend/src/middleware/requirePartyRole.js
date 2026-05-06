import { db } from '../db/index.js'

const ROLE_ORDER = { owner: 3, manager: 2, guest: 1 }

/**
 * Middleware factory that requires the authenticated user to have at least
 * `minRole` in req.party. Super Admins bypass all role checks.
 *
 * Must be used after requireAuth and resolveParty.
 */
export function requirePartyRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated.' })

    // Super Admin has full access everywhere
    if (req.user.is_super_admin) return next()

    if (!req.party) return res.status(500).json({ error: 'Party not resolved.' })

    // Check bans (global or party-scoped)
    const banned = db.prepare(
      `SELECT id FROM bans WHERE user_id = ? AND (party_id IS NULL OR party_id = ?)`
    ).get(req.user.id, req.party.id)
    if (banned) return res.status(403).json({ error: 'You are banned from this party.' })

    const roleRow = db.prepare(
      'SELECT role FROM party_roles WHERE user_id = ? AND party_id = ?'
    ).get(req.user.id, req.party.id)

    if (!roleRow) return res.status(403).json({ error: 'You do not have a role in this party.' })

    if ((ROLE_ORDER[roleRow.role] ?? 0) < (ROLE_ORDER[minRole] ?? 0)) {
      return res.status(403).json({ error: 'Insufficient role for this action.' })
    }

    // Attach resolved role to request for downstream use
    req.partyRole = roleRow.role
    next()
  }
}

/** Convenience: check if req.user has at least minRole in req.party (no middleware, just boolean). */
export function userHasPartyRole(user, party, minRole, dbInstance = db) {
  if (!user || !party) return false
  if (user.is_super_admin) return true

  const banned = dbInstance.prepare(
    `SELECT id FROM bans WHERE user_id = ? AND (party_id IS NULL OR party_id = ?)`
  ).get(user.id, party.id)
  if (banned) return false

  const roleRow = dbInstance.prepare(
    'SELECT role FROM party_roles WHERE user_id = ? AND party_id = ?'
  ).get(user.id, party.id)
  if (!roleRow) return false

  return (ROLE_ORDER[roleRow.role] ?? 0) >= (ROLE_ORDER[minRole] ?? 0)
}
