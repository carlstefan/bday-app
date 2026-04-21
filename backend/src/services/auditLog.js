import { db } from '../db/index.js'

/**
 * Write an event to the audit_log table.
 * Never throws — a logging failure must not crash the request.
 *
 * @param {string}      eventType  One of: login, register, upload, update_caption,
 *                                 flag_deletion, admin_moderate, admin_unhide, admin_download
 * @param {number|null} userId     Authenticated user's id, or null for anonymous
 * @param {string|null} ipAddress  req.ip (requires trust proxy to be set)
 * @param {object}      metadata   Event-specific payload (see TR-B09)
 */
export function logEvent(eventType, userId, ipAddress, metadata = {}) {
  try {
    db.prepare(`
      INSERT INTO audit_log (event_type, user_id, ip_address, metadata)
      VALUES (?, ?, ?, ?)
    `).run(eventType, userId ?? null, ipAddress ?? null, JSON.stringify(metadata))
  } catch (err) {
    console.error('[audit]', eventType, err.message)
  }
}
