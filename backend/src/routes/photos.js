import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { db } from '../db/index.js'
import { diskCheck } from '../middleware/diskCheck.js'
import { handleUpload } from '../middleware/upload.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { processImage } from '../services/imageProcessor.js'
import { uploadBodySchema, captionUpdateSchema, photoIdParamSchema } from '../schemas/photos.js'

const router = Router()

const UPLOADS_PATH = () => process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads')

// ── POST /api/photos ─────────────────────────────────────────────────────────
// Anonymous users may upload; auth is optional
router.post('/', diskCheck, handleUpload, async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' })
    }

    // Validate text fields
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
        file.originalname
      )

      const result = db
        .prepare(
          `INSERT INTO photos (filename, original_name, uploader_name, caption, user_id, captured_at)
           VALUES (@filename, @original_name, @uploader_name, @caption, @user_id, @captured_at)`
        )
        .run({
          filename,
          original_name: file.originalname,
          uploader_name: uploader_name || null,
          caption: caption || null,
          user_id: userId,
          captured_at: capturedAt || null,
        })

      results.push({
        id: result.lastInsertRowid,
        filename,
        original_name: file.originalname,
        uploader_name: uploader_name || null,
        caption: caption || null,
        captured_at: capturedAt || null,
      })
    }

    res.status(201).json({ uploaded: results.length, photos: results })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/photos ──────────────────────────────────────────────────────────
// Authenticated guests only; returns non-hidden, non-pending-deletion photos
router.get('/', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))
  const offset = (page - 1) * limit

  const photos = db
    .prepare(
      `SELECT p.id, p.filename, p.original_name, p.uploader_name, p.caption,
              p.user_id, p.captured_at, p.created_at
       FROM photos p
       WHERE p.is_hidden = 0
         AND NOT EXISTS (
           SELECT 1 FROM deletion_requests dr
           WHERE dr.photo_id = p.id AND dr.status = 'pending'
         )
       ORDER BY COALESCE(p.captured_at, p.created_at) ASC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset)

  const total = db
    .prepare(
      `SELECT COUNT(*) as count FROM photos p
       WHERE p.is_hidden = 0
         AND NOT EXISTS (
           SELECT 1 FROM deletion_requests dr
           WHERE dr.photo_id = p.id AND dr.status = 'pending'
         )`
    )
    .get().count

  res.json({ photos, total, page, limit })
})

// ── GET /api/photos/:id/thumbnail ────────────────────────────────────────────
router.get('/:id/thumbnail', requireAuth, (req, res) => {
  const paramParse = photoIdParamSchema.safeParse(req.params)
  if (!paramParse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const photo = db.prepare('SELECT filename FROM photos WHERE id = ? AND is_hidden = 0').get(paramParse.data.id)
  if (!photo) return res.status(404).json({ error: 'Photo not found.' })

  const uuid = path.parse(photo.filename).name
  const thumbnailPath = path.join(UPLOADS_PATH(), 'thumbnails', `${uuid}.jpg`)

  if (!fs.existsSync(thumbnailPath)) return res.status(404).json({ error: 'Thumbnail not found.' })

  res.setHeader('Content-Type', 'image/jpeg')
  res.setHeader('Cache-Control', 'private, max-age=86400')
  fs.createReadStream(thumbnailPath).pipe(res)
})

// ── GET /api/photos/:id/image ────────────────────────────────────────────────
router.get('/:id/image', requireAuth, (req, res) => {
  const paramParse = photoIdParamSchema.safeParse(req.params)
  if (!paramParse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const photo = db.prepare('SELECT filename FROM photos WHERE id = ? AND is_hidden = 0').get(paramParse.data.id)
  if (!photo) return res.status(404).json({ error: 'Photo not found.' })

  const imagePath = path.join(UPLOADS_PATH(), photo.filename)
  if (!fs.existsSync(imagePath)) return res.status(404).json({ error: 'Image file not found.' })

  const ext = path.extname(photo.filename).toLowerCase()
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' }
  const contentType = mimeTypes[ext] || 'application/octet-stream'

  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Disposition', 'inline')
  res.setHeader('Cache-Control', 'private, max-age=86400')
  fs.createReadStream(imagePath).pipe(res)
})

// ── PATCH /api/photos/:id/caption ────────────────────────────────────────────
router.patch('/:id/caption', requireAuth, (req, res) => {
  const paramParse = photoIdParamSchema.safeParse(req.params)
  if (!paramParse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const bodyParse = captionUpdateSchema.safeParse(req.body)
  if (!bodyParse.success) return res.status(400).json({ error: bodyParse.error.errors[0].message })

  const photo = db.prepare('SELECT id, user_id FROM photos WHERE id = ?').get(paramParse.data.id)
  if (!photo) return res.status(404).json({ error: 'Photo not found.' })

  if (photo.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit captions on your own photos.' })
  }

  db.prepare('UPDATE photos SET caption = ? WHERE id = ?').run(bodyParse.data.caption, photo.id)

  res.json({ id: photo.id, caption: bodyParse.data.caption })
})

// ── POST /api/photos/:id/flag ────────────────────────────────────────────────
router.post('/:id/flag', requireAuth, (req, res) => {
  const paramParse = photoIdParamSchema.safeParse(req.params)
  if (!paramParse.success) return res.status(400).json({ error: 'Invalid photo ID.' })

  const photoId = paramParse.data.id
  const photo = db.prepare('SELECT id FROM photos WHERE id = ? AND is_hidden = 0').get(photoId)
  if (!photo) return res.status(404).json({ error: 'Photo not found.' })

  const existing = db
    .prepare("SELECT id FROM deletion_requests WHERE photo_id = ? AND status = 'pending'")
    .get(photoId)

  if (existing) {
    return res.status(409).json({ error: 'This photo has already been flagged for review.' })
  }

  // Hide immediately and create deletion request
  db.prepare('UPDATE photos SET is_hidden = 1 WHERE id = ?').run(photoId)
  db.prepare(
    `INSERT INTO deletion_requests (photo_id, flagged_by_user_id) VALUES (?, ?)`
  ).run(photoId, req.user.id)

  res.status(201).json({ message: 'Photo flagged for admin review.' })
})

export default router
