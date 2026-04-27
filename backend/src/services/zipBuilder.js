import archiver from 'archiver'
import path from 'path'
import fs from 'fs'
import { db } from '../db/index.js'

const UPLOADS_PATH = () => process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads')

/**
 * Build a filename for the zip entry.
 * Format: YYYYMMDD_HHMMSS_[uploader_name].[ext]
 * Falls back to created_at if captured_at is absent.
 */
function zipEntryName(photo) {
  const raw  = photo.captured_at || photo.created_at || ''
  // Parse ISO or SQLite datetime "YYYY-MM-DDTHH:MM:SS" / "YYYY-MM-DD HH:MM:SS"
  const dt   = raw.replace('T', ' ')
  const m    = dt.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  const stamp = m ? `${m[1]}${m[2]}${m[3]}_${m[4]}${m[5]}${m[6]}` : 'unknown'

  const safeUploader = (photo.uploader_name || 'guest')
    .replace(/[^a-zA-Z0-9\u00C0-\u024F _-]/g, '')  // keep ASCII + Latin extended
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40)

  const ext = path.extname(photo.filename) || '.jpg'
  return `${stamp}_${safeUploader}${ext}`
}

/**
 * Stream all non-deleted photos as a zip to the writable stream `dest`.
 */
export async function buildZip(dest) {
  const photos = db.prepare(`
    SELECT id, filename, original_name, uploader_name, caption, captured_at, created_at
    FROM photos
    WHERE id NOT IN (
      SELECT photo_id FROM deletion_requests WHERE status = 'deleted'
    )
    ORDER BY COALESCE(captured_at, created_at) ASC
  `).all()

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 1 } }) // fast compression

    archive.on('error', reject)
    dest.on('error', reject)
    archive.on('finish', resolve)

    archive.pipe(dest)

    for (const photo of photos) {
      const filePath = path.join(UPLOADS_PATH(), photo.filename)
      if (!fs.existsSync(filePath)) continue

      const entryName = zipEntryName(photo)
      archive.file(filePath, { name: entryName })
    }

    archive.finalize()
  })
}
