export function requireAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.is_admin) return next()
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Authentication required.' })
  res.status(403).json({ error: 'Admin access required.' })
}
