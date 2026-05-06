/**
 * Party-scoped router — mounted at /api/p/:partyKey
 *
 * All routes here resolve the party via resolveParty middleware and enforce
 * role-based access via requirePartyRole where needed.
 */
import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { db } from '../db/index.js'
import { resolveParty } from '../middleware/resolveParty.js'
import { requirePartyRole } from '../middleware/requirePartyRole.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { diskCheck } from '../middleware/diskCheck.js'
import { handleUpload } from '../middleware/upload.js'
import { uploadLimiter } from '../middleware/rateLimiter.js'
import { processImage, deleteImageFiles, resolveOriginalPath, resolveThumbnailPath } from '../services/imageProcessor.js'
import { buildZip } from '../services/zipBuilder.js'
import { logEvent } from '../services/auditLog.js'
import { uploadBodySchema, captionUpdateSchema, photoIdParamSchema } from '../schemas/photos.js'
import { z } from 'zod'

const router = Router({ mergeParams: true })

// Resolve party on every request in this router
router.use(resolveParty)

const idParam = z.object({ id: z.coerce.number().int().positive() })

// ── GET /api/p/:partyKey/photos ───────────────────────────────────────────
// Visible non-hidden photos for this party. Requires auth + at least guest role.
router.get('/photos', requireAuth, requirePartyRole('guest'), (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 500))
  const offset = (page - 1) * limit

  const photos = db.prepare(`
    SELECT p.id, p.filename, p.original_name, p.uploader_name, p.caption,
           p.user_id, p.captured_at, p.created_at
    FROM photos p
    WHERE p.party_id = ? AND p.is_hidden = 0
    ORDER BY COALESCE(p.captured_at, p.created_at) ASC
    LIMIT ? OFFSET ?
  `).all(req.party.id, limit, offset)

  const { count: total } = db.prepare(
    `SELECT COUNT(*) AS count FROM photos WHERE party_id = ? AND is_hidden = 0`
  ).get(req.party.id)

  res.json({ photos, total, page, limit })
})

// ── POST /api/p/:partyKey/photos ──────────────────────────────────────────
// Upload. Anonymous if party allows it; auth required if not.
router.post('/photos', uploadLimiter, diskCheck, handleUpload, async (req, res, next) => {
  try {
    const party = req.party

    // FR-G13: Check party submission state
    if (!party.submissions_open) {
      return res.status(403).json({ error: 'The party owner is not currently allowing uploads.' })
    }
    if (!party.anonymous_uploads_enabled && !req.isAuthenticated()) {
      return res.status(403).json({ error: 'Anonymous uploads are not enabled for this party.' })
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' })
    }

    const bodyParse = uploadBodySchema.safeParse(req.body)
    if (!bodyParse.success) {
      return res.status(400).json({ error: bodyParse.error.errors[0].message })
    }

    const { uploader_name, caption } = bodyParse.data
    const userId = req.isAuthenticated() ? req.user.id : null
    const results = []

    for (const file of req.files) {
      const { filename, capturedAt } = await processImage(
        file.buffer,
        file.mimetype,
        file.originalname,
        party.party_key
      )

      const result = db.prepare(`
        INSERT INTO photos (filename, original_name, uploader_name, caption, user_id, party_id, captured_at)
        VALUES (@filename, @original_name, @uploader_name, @caption, @user_id, @party_id, @captured_at)
      `).run({
        filename,
        original_name: file.originalname,
        uploader_name: uploader_name || null,
        caption: caption || null,
        user_id: userId,
        party_id: party.id,
        captured_at: capturedAt || null,
      })

      results.push({ id: result.lastInsertRowid, filename })
    }

    logEvent('upload', userId, req.ip, { photo_ids: results.map(r => r.id), count: results.length, party_key: party.party_key })

    res.status(201).json({ uploaded: results.length, photos: results })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/p/:partyKey/photos/:id/thumbnail ────────────────────────────
router.get('/photos/:id/thumbnail', requireAuth, requirePartyRole('guest'), (req, res) => {
  const parse = photoIdParamSchema.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const canSeeHidden = req.user.is_super_admin || ['owner', 'manager'].includes(req.partyRole)
  const photo = canSeeHidden
    ? db.prepare('SELECT filename FROM photos WHERE id = ? AND party_id = ?').get(parse.data.id, req.party.id)
    : db.prepare('SELECT filename FROM photos WHERE id = ? AND party_id = ? AND is_hidden = 0').get(parse.data.id, req.party.id)

  if (!photo) return res.status(404).json({ error: 'Photo not found.' })

  const thumbPath = resolveThumbnailPath(photo.filename, req.party.party_key)
  if (!fs.existsSync(thumbPath)) return res.status(404).json({ error: 'Thumbnail not found.' })

  res.setHeader('Content-Type', 'image/jpeg')
  res.setHeader('Cache-Control', 'private, no-cache, must-revalidate')
  fs.createReadStream(thumbPath).pipe(res)
})

// ── GET /api/p/:partyKey/photos/:id/image ────────────────────────────────
router.get('/photos/:id/image', requireAuth, requirePartyRole('guest'), (req, res) => {
  const parse = photoIdParamSchema.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const canSeeHidden = req.user.is_super_admin || ['owner', 'manager'].includes(req.partyRole)
  const photo = canSeeHidden
    ? db.prepare('SELECT filename FROM photos WHERE id = ? AND party_id = ?').get(parse.data.id, req.party.id)
    : db.prepare('SELECT filename FROM photos WHERE id = ? AND party_id = ? AND is_hidden = 0').get(parse.data.id, req.party.id)

  if (!photo) return res.status(404).json({ error: 'Photo not found.' })

  const imagePath = resolveOriginalPath(photo.filename, req.party.party_key)
  if (!fs.existsSync(imagePath)) return res.status(404).json({ error: 'Image not found.' })

  const ext = path.extname(photo.filename).toLowerCase()
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' }
  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
  res.setHeader('Content-Disposition', 'inline')
  res.setHeader('Cache-Control', 'private, no-cache, must-revalidate')
  fs.createReadStream(imagePath).pipe(res)
})

// ── GET /api/p/:partyKey/featured-photo ─────────────────────────────────
// Public: returns thumbnail of the featured photo (no auth required)
router.get('/featured-photo', (req, res) => {
  const party = req.party
  if (!party.featured_photo_id) return res.status(404).json({ error: 'No featured photo set.' })

  const photo = db.prepare('SELECT filename FROM photos WHERE id = ?').get(party.featured_photo_id)
  if (!photo) return res.status(404).json({ error: 'Featured photo not found.' })

  const thumbPath = resolveThumbnailPath(photo.filename, party.party_key)
  if (!fs.existsSync(thumbPath)) return res.status(404).json({ error: 'Thumbnail not found.' })

  res.setHeader('Content-Type', 'image/jpeg')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  fs.createReadStream(thumbPath).pipe(res)
})

// ── PATCH /api/p/:partyKey/photos/:id/caption ─────────────────────────────
router.patch('/photos/:id/caption', requireAuth, requirePartyRole('guest'), (req, res) => {
  const parse = photoIdParamSchema.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const bodyParse = captionUpdateSchema.safeParse(req.body)
  if (!bodyParse.success) return res.status(400).json({ error: bodyParse.error.errors[0].message })

  const photo = db.prepare('SELECT id, user_id, caption FROM photos WHERE id = ? AND party_id = ?').get(parse.data.id, req.party.id)
  if (!photo) return res.status(404).json({ error: 'Photo not found.' })

  const isManager = req.user.is_super_admin || ['owner', 'manager'].includes(req.partyRole)
  if (!isManager && photo.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit captions on your own photos.' })
  }

  db.prepare('UPDATE photos SET caption = ? WHERE id = ?').run(bodyParse.data.caption, photo.id)
  logEvent('update_caption', req.user.id, req.ip, { photo_id: photo.id, old_caption: photo.caption, new_caption: bodyParse.data.caption })
  res.json({ id: photo.id, caption: bodyParse.data.caption })
})

// ── POST /api/p/:partyKey/photos/:id/flag ─────────────────────────────────
router.post('/photos/:id/flag', requireAuth, requirePartyRole('guest'), (req, res) => {
  const parse = photoIdParamSchema.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const photoId = parse.data.id
  const photo = db.prepare('SELECT id, user_id FROM photos WHERE id = ? AND party_id = ? AND is_hidden = 0').get(photoId, req.party.id)
  if (!photo) return res.status(404).json({ error: 'Photo not found.' })

  const existing = db.prepare("SELECT id FROM deletion_requests WHERE photo_id = ? AND status = 'pending'").get(photoId)
  if (existing) return res.status(409).json({ error: 'This photo has already been flagged for review.' })

  const isOwnPhoto = photo.user_id !== null && photo.user_id === req.user.id ? 1 : 0

  db.transaction(() => {
    if (isOwnPhoto) db.prepare('UPDATE photos SET is_hidden = 1 WHERE id = ?').run(photoId)
    db.prepare('INSERT INTO deletion_requests (photo_id, flagged_by_user_id, is_own_photo) VALUES (?, ?, ?)').run(photoId, req.user.id, isOwnPhoto)
  })()

  logEvent('flag_deletion', req.user.id, req.ip, { photo_id: photoId, is_own_photo: Boolean(isOwnPhoto), auto_hidden: Boolean(isOwnPhoto) })

  const message = isOwnPhoto
    ? 'Bildet ditt er skjult og sendt til admin for gjennomgang.'
    : 'Bildet er rapportert og vil bli gjennomgått av en admin.'

  res.status(201).json({ message, auto_hidden: Boolean(isOwnPhoto) })
})

// ── GET /api/p/:partyKey/admin/photos ─────────────────────────────────────
router.get('/admin/photos', requireAuth, requirePartyRole('manager'), (_req, res) => {
  const photos = db.prepare(`
    SELECT p.*,
      EXISTS (SELECT 1 FROM deletion_requests dr WHERE dr.photo_id = p.id AND dr.status = 'pending') AS has_pending_flag
    FROM photos p
    WHERE p.party_id = ?
    ORDER BY COALESCE(p.captured_at, p.created_at) ASC
  `).all(_req.party.id)
  res.json({ photos })
})

// ── GET /api/p/:partyKey/admin/hidden-photos ──────────────────────────────
router.get('/admin/hidden-photos', requireAuth, requirePartyRole('manager'), (req, res) => {
  const photos = db.prepare(`
    SELECT p.*,
      EXISTS (SELECT 1 FROM deletion_requests dr WHERE dr.photo_id = p.id AND dr.status = 'pending') AS has_pending_flag
    FROM photos p
    WHERE p.party_id = ? AND p.is_hidden = 1
    ORDER BY COALESCE(p.captured_at, p.created_at) ASC
  `).all(req.party.id)
  res.json({ photos })
})

// ── GET /api/p/:partyKey/admin/pending-count ──────────────────────────────
router.get('/admin/pending-count', requireAuth, requirePartyRole('manager'), (req, res) => {
  const { count } = db.prepare(`
    SELECT COUNT(*) AS count FROM deletion_requests dr
    JOIN photos p ON p.id = dr.photo_id
    WHERE dr.status = 'pending' AND p.party_id = ?
  `).get(req.party.id)
  res.json({ count })
})

// ── PATCH /api/p/:partyKey/admin/photos/:id/hide ──────────────────────────
router.patch('/admin/photos/:id/hide', requireAuth, requirePartyRole('manager'), (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo ID.' })
  const info = db.prepare('UPDATE photos SET is_hidden = 1 WHERE id = ? AND party_id = ?').run(parse.data.id, req.party.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Photo not found.' })
  logEvent('admin_moderate', req.user.id, req.ip, { photo_id: parse.data.id, action: 'hide' })
  res.json({ id: parse.data.id, is_hidden: true })
})

// ── PATCH /api/p/:partyKey/admin/photos/:id/unhide ────────────────────────
router.patch('/admin/photos/:id/unhide', requireAuth, requirePartyRole('manager'), (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid photo ID.' })
  const info = db.prepare('UPDATE photos SET is_hidden = 0 WHERE id = ? AND party_id = ?').run(parse.data.id, req.party.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Photo not found.' })
  logEvent('admin_unhide', req.user.id, req.ip, { photo_id: parse.data.id })
  res.json({ id: parse.data.id, is_hidden: false })
})

// ── GET /api/p/:partyKey/admin/deletion-requests ─────────────────────────
router.get('/admin/deletion-requests', requireAuth, requirePartyRole('manager'), (req, res) => {
  const requests = db.prepare(`
    SELECT dr.id, dr.status, dr.flagged_at, dr.is_own_photo,
      p.id AS photo_id, p.filename, p.original_name, p.uploader_name, p.caption, p.captured_at, p.is_hidden,
      flagger.display_name AS flagged_by_name
    FROM deletion_requests dr
    JOIN photos p       ON p.id  = dr.photo_id
    JOIN users  flagger ON flagger.id = dr.flagged_by_user_id
    WHERE dr.status = 'pending' AND p.party_id = ?
    ORDER BY dr.flagged_at ASC
  `).all(req.party.id)
  res.json({ requests })
})

// ── PATCH /api/p/:partyKey/admin/deletion-requests/:id/delete ────────────
router.patch('/admin/deletion-requests/:id/delete', requireAuth, requirePartyRole('manager'), async (req, res, next) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid request ID.' })
  try {
    const request = db.prepare(`
      SELECT dr.id, p.id AS photo_id, p.filename
      FROM deletion_requests dr JOIN photos p ON p.id = dr.photo_id
      WHERE dr.id = ? AND dr.status = 'pending' AND p.party_id = ?
    `).get(parse.data.id, req.party.id)
    if (!request) return res.status(404).json({ error: 'Deletion request not found.' })

    await deleteImageFiles(request.filename, req.party.party_key)

    db.transaction(() => {
      db.prepare(`UPDATE deletion_requests SET status = 'deleted', resolved_at = datetime('now'), resolved_by_user_id = ? WHERE id = ?`).run(req.user.id, request.id)
      db.prepare('DELETE FROM photos WHERE id = ?').run(request.photo_id)
    })()

    logEvent('admin_moderate', req.user.id, req.ip, { photo_id: request.photo_id, action: 'delete', deletion_request_id: request.id })
    res.json({ message: 'Photo deleted.' })
  } catch (err) { next(err) }
})

// ── PATCH /api/p/:partyKey/admin/deletion-requests/:id/reject ────────────
router.patch('/admin/deletion-requests/:id/reject', requireAuth, requirePartyRole('manager'), (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid request ID.' })

  const request = db.prepare(`
    SELECT dr.id, dr.is_own_photo, p.id AS photo_id
    FROM deletion_requests dr JOIN photos p ON p.id = dr.photo_id
    WHERE dr.id = ? AND dr.status = 'pending' AND p.party_id = ?
  `).get(parse.data.id, req.party.id)
  if (!request) return res.status(404).json({ error: 'Deletion request not found.' })

  db.transaction(() => {
    if (request.is_own_photo) db.prepare('UPDATE photos SET is_hidden = 0 WHERE id = ?').run(request.photo_id)
    db.prepare(`UPDATE deletion_requests SET status = 'rejected', resolved_at = datetime('now'), resolved_by_user_id = ? WHERE id = ?`).run(req.user.id, request.id)
  })()

  logEvent('admin_moderate', req.user.id, req.ip, { photo_id: request.photo_id, action: 'reject', deletion_request_id: request.id, photo_restored: Boolean(request.is_own_photo) })
  res.json({ message: request.is_own_photo ? 'Deletion request rejected. Photo restored to gallery.' : 'Deletion request rejected.' })
})

// ── PATCH /api/p/:partyKey/admin/deletion-requests/:id/hide ──────────────
router.patch('/admin/deletion-requests/:id/hide', requireAuth, requirePartyRole('manager'), (req, res) => {
  const parse = idParam.safeParse(req.params)
  if (!parse.success) return res.status(400).json({ error: 'Invalid request ID.' })

  const request = db.prepare(`
    SELECT dr.id, p.id AS photo_id
    FROM deletion_requests dr JOIN photos p ON p.id = dr.photo_id
    WHERE dr.id = ? AND dr.status = 'pending' AND p.party_id = ?
  `).get(parse.data.id, req.party.id)
  if (!request) return res.status(404).json({ error: 'Deletion request not found.' })

  db.transaction(() => {
    db.prepare('UPDATE photos SET is_hidden = 1 WHERE id = ?').run(request.photo_id)
    db.prepare(`UPDATE deletion_requests SET status = 'hidden', resolved_at = datetime('now'), resolved_by_user_id = ? WHERE id = ?`).run(req.user.id, request.id)
  })()

  logEvent('admin_moderate', req.user.id, req.ip, { photo_id: request.photo_id, action: 'hide_from_queue', deletion_request_id: request.id })
  res.json({ message: 'Photo left hidden.' })
})

// ── GET /api/p/:partyKey/admin/download ──────────────────────────────────
router.get('/admin/download', requireAuth, requirePartyRole('manager'), async (req, res, next) => {
  try {
    const { count: photoCount } = db.prepare(`SELECT COUNT(*) AS count FROM photos WHERE party_id = ? AND is_hidden = 0`).get(req.party.id)
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${req.party.party_key}-photos.zip"`)
    await buildZip(res, { partyId: req.party.id, partyKey: req.party.party_key })
    logEvent('admin_download', req.user.id, req.ip, { photo_count: photoCount, party_key: req.party.party_key })
  } catch (err) { next(err) }
})

export default router
