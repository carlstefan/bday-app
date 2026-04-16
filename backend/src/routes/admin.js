import { Router } from 'express'
import { db } from '../db/index.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { deleteImageFiles } from '../services/imageProcessor.js'
import { buildZip } from '../services/zipBuilder.js'
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

// ── PATCH /api/admin/photos/:id/hide ────────────────────────────────────────
router.patch('/photos/:id/hide', (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const info = db.prepare('UPDATE photos SET is_hidden = 1 WHERE id = ?').run(parse.data.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Photo not found.' })

  res.json({ id: parse.data.id, is_hidden: true })
})

// ── PATCH /api/admin/photos/:id/unhide ──────────────────────────────────────
router.patch('/photos/:id/unhide', (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const info = db.prepare('UPDATE photos SET is_hidden = 0 WHERE id = ?').run(parse.data.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Photo not found.' })

  res.json({ id: parse.data.id, is_hidden: false })
})

// ── GET /api/admin/deletion-requests ────────────────────────────────────────
router.get('/deletion-requests', (_req, res) => {
  const requests = db.prepare(`
    SELECT
      dr.id,
      dr.status,
      dr.flagged_at,
      p.id          AS photo_id,
      p.filename,
      p.original_name,
      p.uploader_name,
      p.caption,
      p.captured_at,
      flagger.display_name AS flagged_by_name
    FROM deletion_requests dr
    JOIN photos p            ON p.id  = dr.photo_id
    JOIN users  flagger      ON flagger.id = dr.flagged_by_user_id
    WHERE dr.status = 'pending'
    ORDER BY dr.flagged_at ASC
  `).all()

  res.json({ requests })
})

// ── PATCH /api/admin/deletion-requests/:id/accept ───────────────────────────
// Delete photo from disk and database
router.patch('/deletion-requests/:id/accept', async (req, res, next) => {
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
      db.prepare(`UPDATE deletion_requests SET status = 'accepted', resolved_at = datetime('now') WHERE id = ?`).run(request.id)
      db.prepare('DELETE FROM photos WHERE id = ?').run(request.photo_id)
    })()

    res.json({ message: 'Photo deleted.' })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/admin/deletion-requests/:id/deny ─────────────────────────────
// Unhide the photo and close the request
router.patch('/deletion-requests/:id/deny', (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid request ID.' })

  const request = db.prepare(`
    SELECT dr.id, p.id AS photo_id
    FROM deletion_requests dr JOIN photos p ON p.id = dr.photo_id
    WHERE dr.id = ? AND dr.status = 'pending'
  `).get(parse.data.id)

  if (!request) return res.status(404).json({ error: 'Deletion request not found.' })

  db.transaction(() => {
    db.prepare('UPDATE photos SET is_hidden = 0 WHERE id = ?').run(request.photo_id)
    db.prepare(`UPDATE deletion_requests SET status = 'denied', resolved_at = datetime('now'), resolved_by_user_id = ? WHERE id = ?`)
      .run(req.user.id, request.id)
  })()

  res.json({ message: 'Deletion request denied. Photo restored.' })
})

// ── PATCH /api/admin/deletion-requests/:id/leave-hidden ─────────────────────
// Keep the photo hidden, mark request resolved
router.patch('/deletion-requests/:id/leave-hidden', (req, res) => {
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
    db.prepare(`UPDATE deletion_requests SET status = 'left_hidden', resolved_at = datetime('now'), resolved_by_user_id = ? WHERE id = ?`)
      .run(req.user.id, request.id)
  })()

  res.json({ message: 'Photo left hidden.' })
})

// ── GET /api/admin/download ─────────────────────────────────────────────────
// Stream a zip of all non-deleted photos
router.get('/download', async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="party-photos.zip"')
    await buildZip(res)
  } catch (err) {
    next(err)
  }
})

export default router
