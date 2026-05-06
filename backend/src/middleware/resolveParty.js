import { db } from '../db/index.js'

export function resolveParty(req, res, next) {
  const party = db.prepare('SELECT * FROM parties WHERE party_key = ?').get(req.params.partyKey)
  if (!party) return res.status(404).json({ error: 'Party not found.' })
  req.party = party
  next()
}
