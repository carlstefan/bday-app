import archiver from 'archiver'
import path from 'path'
import fs from 'fs'
import { db } from '../db/index.js'
import { resolveOriginalPath } from './imageProcessor.js'

function zipEntryName(photo) {
  const raw   = photo.captured_at || photo.created_at || ''
  const dt    = raw.replace('T', ' ')
  const m     = dt.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  const stamp = m ? `${m[1]}${m[2]}${m[3]}_${m[4]}${m[5]}${m[6]}` : 'unknown'

  const safeUploader = (photo.uploader_name || 'guest')
    .replace(/[^a-zA-Z0-9À-ɏ _-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40)

  const ext = path.extname(photo.filename) || '.jpg'
  // Append the short UUID so entries stay unique. Without it, two photos from
  // the same uploader with the same second-level timestamp (burst shots, or
  // several files lacking EXIF that fall back to 'unknown') would produce
  // identical names and silently overwrite each other on extraction.
  const shortId = path.parse(photo.filename).name.slice(0, 8)
  return `${stamp}_${safeUploader}_${shortId}${ext}`
}

/**
 * Stream all non-deleted photos as a zip to the writable stream `dest`.
 *
 * @param {import('stream').Writable} dest
 * @param {object} [options]
 * @param {number} [options.partyId]   - when set, limit to photos in this party
 * @param {string} [options.partyKey]  - used to resolve file paths
 */
export async function buildZip(dest, { partyId = null, partyKey = null } = {}) {
  const partyCond  = partyId ? 'AND p.party_id = ?' : ''
  const partyArgs  = partyId ? [partyId] : []

  const photos = db.prepare(`
    SELECT p.id, p.filename, p.original_name, p.uploader_name, p.caption, p.captured_at, p.created_at
    FROM photos p
    WHERE p.id NOT IN (
      SELECT photo_id FROM deletion_requests WHERE status = 'deleted'
    )
    ${partyCond}
    ORDER BY COALESCE(p.captured_at, p.created_at) ASC
  `).all(...partyArgs)

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 1 } })

    archive.on('error', reject)
    dest.on('error', reject)
    archive.on('finish', resolve)

    archive.pipe(dest)

    for (const photo of photos) {
      const filePath = resolveOriginalPath(photo.filename, partyKey)
      if (!fs.existsSync(filePath)) continue
      archive.file(filePath, { name: zipEntryName(photo) })
    }

    archive.finalize()
  })
}
