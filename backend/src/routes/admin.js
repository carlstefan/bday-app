import { Router } from 'express'
import { db } from '../db/index.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { deleteImageFiles } from '../services/imageProcessor.js'
import { buildZip } from '../services/zipBuilder.js'
import { logEvent } from '../services/auditLog.js'
import { z } from 'zod'

const router = Router()

// All admin routes require admin authentication
router.use(requireAdmin)

const idParam = z.object({ id: z.coerce.number().int().positive() })

// ── GET /api/admin/photos ────────────────────────────────────────────────────
// All photos including hidden, with pending deletion flag
router.get('/photos', (_req, res) => {
  const photos = db.prepare(`
    SELECT
      p.*,
      EXISTS (
        SELECT 1 FROM deletion_requests dr
        WHERE dr.photo_id = p.id AND dr.status = 'pending'
      ) AS has_pending_flag
    FROM photos p
    ORDER BY COALESCE(p.captured_at, p.created_at) ASC
  `).all()

  res.json({ photos })
})

// ── GET /api/admin/hidden-photos ─────────────────────────────────────────────
// FR-A05: Hidden photos only, with pending deletion flag indicator
router.get('/hidden-photos', (_req, res) => {
  const photos = db.prepare(`
    SELECT
      p.*,
      EXISTS (
        SELECT 1 FROM deletion_requests dr
        WHERE dr.photo_id = p.id AND dr.status = 'pending'
      ) AS has_pending_flag
    FROM photos p
    WHERE p.is_hidden = 1
    ORDER BY COALESCE(p.captured_at, p.created_at) ASC
  `).all()

  res.json({ photos })
})

// ── GET /api/admin/pending-count ─────────────────────────────────────────────
// FR-A04: Count of pending deletion requests (for notification badge)
router.get('/pending-count', (_req, res) => {
  const { count } = db
    .prepare(`SELECT COUNT(*) AS count FROM deletion_requests WHERE status = 'pending'`)
    .get()

  res.json({ count })
})

// ── PATCH /api/admin/photos/:id/hide ────────────────────────────────────────
router.patch('/photos/:id/hide', (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const info = db.prepare('UPDATE photos SET is_hidden = 1 WHERE id = ?').run(parse.data.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Photo not found.' })

  logEvent('admin_moderate', req.user.id, req.ip, {
    photo_id: parse.data.id,
    action: 'hide',
  })

  res.json({ id: parse.data.id, is_hidden: true })
})

// ── PATCH /api/admin/photos/:id/unhide ──────────────────────────────────────
router.patch('/photos/:id/unhide', (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const info = db.prepare('UPDATE photos SET is_hidden = 0 WHERE id = ?').run(parse.data.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Photo not found.' })

  logEvent('admin_unhide', req.user.id, req.ip, { photo_id: parse.data.id })

  res.json({ id: parse.data.id, is_hidden: false })
})

// ── GET /api/admin/deletion-requests ────────────────────────────────────────
router.get('/deletion-requests', (_req, res) => {
  const requests = db.prepare(`
    SELECT
      dr.id,
      dr.status,
      dr.flagged_at,
      dr.is_own_photo,
      p.id            AS photo_id,
      p.filename,
      p.original_name,
      p.uploader_name,
      p.caption,
      p.captured_at,
      p.is_hidden,
      flagger.display_name AS flagged_by_name
    FROM deletion_requests dr
    JOIN photos p       ON p.id  = dr.photo_id
    JOIN users  flagger ON flagger.id = dr.flagged_by_user_id
    WHERE dr.status = 'pending'
    ORDER BY dr.flagged_at ASC
  `).all()

  res.json({ requests })
})

// ── PATCH /api/admin/deletion-requests/:id/delete ───────────────────────────
// FR-A02: Delete photo from disk and database (previously /accept)
router.patch('/deletion-requests/:id/delete', async (req, res, next) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid request ID.' })

  try {
    const request = db.prepare(`
      SELECT dr.id, p.id AS photo_id, p.filename
      FROM deletion_requests dr
      JOIN photos p ON p.id = dr.photo_id
      WHERE dr.id = ? AND dr.status = 'pending'
    `).get(parse.data.id)

    if (!request) return res.status(404).json({ error: 'Deletion request not found.' })

    // Delete files from disk (best-effort)
    await deleteImageFiles(request.filename)

    // Update DB in a transaction
    db.transaction(() => {
      db.prepare(
        `UPDATE deletion_requests SET status = 'deleted', resolved_at = datetime('now'), resolved_by_user_id = ? WHERE id = ?`
      ).run(req.user.id, request.id)
      db.prepare('DELETE FROM photos WHERE id = ?').run(request.photo_id)
    })()

    logEvent('admin_moderate', req.user.id, req.ip, {
      photo_id: request.photo_id,
      action: 'delete',
      deletion_request_id: request.id,
    })

    res.json({ message: 'Photo deleted.' })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/admin/deletion-requests/:id/reject ───────────────────────────
// FR-A02: Reject deletion request.
// If the flag was on own photo (is_own_photo=1) the photo was auto-hidden at flag time → restore it.
// If flagged by another user the photo was never hidden by the flag → leave visibility as-is.
router.patch('/deletion-requests/:id/reject', (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid request ID.' })

  const request = db.prepare(`
    SELECT dr.id, dr.is_own_photo, p.id AS photo_id
    FROM deletion_requests dr
    JOIN photos p ON p.id = dr.photo_id
    WHERE dr.id = ? AND dr.status = 'pending'
  `).get(parse.data.id)

  if (!request) return res.status(404).json({ error: 'Deletion request not found.' })

  db.transaction(() => {
    // Restore visibility only if the flag caused the hide
    if (request.is_own_photo) {
      db.prepare('UPDATE photos SET is_hidden = 0 WHERE id = ?').run(request.photo_id)
    }
    db.prepare(
      `UPDATE deletion_requests SET status = 'rejected', resolved_at = datetime('now'), resolved_by_user_id = ? WHERE id = ?`
    ).run(req.user.id, request.id)
  })()

  logEvent('admin_moderate', req.user.id, req.ip, {
    photo_id: request.photo_id,
    action: 'reject',
    deletion_request_id: request.id,
    photo_restored: Boolean(request.is_own_photo),
  })

  const message = request.is_own_photo
    ? 'Deletion request rejected. Photo restored to gallery.'
    : 'Deletion request rejected.'

  res.json({ message })
})

// ── PATCH /api/admin/deletion-requests/:id/hide ──────────────────────────────
// FR-A02: Keep the photo hidden, mark request resolved (previously /leave-hidden)
router.patch('/deletion-requests/:id/hide', (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid request ID.' })

  const request = db.prepare(`
    SELECT dr.id, p.id AS photo_id
    FROM deletion_requests dr JOIN photos p ON p.id = dr.photo_id
    WHERE dr.id = ? AND dr.status = 'pending'
  `).get(parse.data.id)

  if (!request) return res.status(404).json({ error: 'Deletion request not found.' })

  db.transaction(() => {
    db.prepare('UPDATE photos SET is_hidden = 1 WHERE id = ?').run(request.photo_id)
    db.prepare(
      `UPDATE deletion_requests SET status = 'hidden', resolved_at = datetime('now'), resolved_by_user_id = ? WHERE id = ?`
    ).run(req.user.id, request.id)
  })()

  logEvent('admin_moderate', req.user.id, req.ip, {
    photo_id: request.photo_id,
    action: 'hide_from_queue',
    deletion_request_id: request.id,
  })

  res.json({ message: 'Photo left hidden.' })
})

// ── GET /api/admin/download ─────────────────────────────────────────────────
// Stream a zip of all non-deleted photos
router.get('/download', async (req, res, next) => {
  try {
    const { count: photoCount } = db
      .prepare(`SELECT COUNT(*) AS count FROM photos WHERE is_hidden = 0`)
      .get()

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="party-photos.zip"')
    await buildZip(res)

    logEvent('admin_download', req.user.id, req.ip, { photo_count: photoCount })
  } catch (err) {
    next(err)
  }
})

export default router
