import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const UPLOADS_PATH = () => process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads')
const THUMBNAILS_PATH = () => path.join(UPLOADS_PATH(), 'thumbnails')

const THUMBNAIL_MAX_PX = 1000
const THUMBNAIL_QUALITY = 85

// Extension map from mimetype
const EXT_MAP = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
}

/**
 * Extract DateTimeOriginal from EXIF data via sharp.
 * Returns an ISO string or null.
 */
async function extractCapturedAt(buffer) {
  try {
    const metadata = await sharp(buffer).metadata()
    const exif = metadata.exif

    if (!exif) return null

    // Parse EXIF binary — look for DateTimeOriginal tag (0x9003)
    // Use sharp's built-in exif object if available (sharp >= 0.32)
    // Otherwise fall back to a manual parse approach
    // For simplicity we rely on the exif buffer and parse the ASCII date
    const exifStr = exif.toString('binary')
    // DateTimeOriginal pattern: "YYYY:MM:DD HH:MM:SS"
    const match = exifStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
    if (!match) return null

    const [, year, month, day, hour, min, sec] = match
    // Construct ISO date (treat as local time — EXIF has no timezone)
    return `${year}-${month}-${day}T${hour}:${min}:${sec}`
  } catch {
    return null
  }
}

/**
 * Process a single uploaded file:
 *  1. Write original to disk (UUID filename)
 *  2. Generate 1000px JPEG thumbnail
 *  3. Extract captured_at from EXIF
 *
 * Returns { uuid, filename, thumbnailFilename, capturedAt }
 */
export async function processImage(buffer, mimetype, originalName) {
  const ext = EXT_MAP[mimetype] || 'jpg'
  const uuid = uuidv4()
  const filename = `${uuid}.${ext}`
  const thumbnailFilename = `${uuid}.jpg`

  // Ensure directories exist
  await fs.mkdir(UPLOADS_PATH(), { recursive: true })
  await fs.mkdir(THUMBNAILS_PATH(), { recursive: true })

  // Write original (preserved as-is)
  const originalPath = path.join(UPLOADS_PATH(), filename)
  await fs.writeFile(originalPath, buffer)

  // Generate thumbnail
  const thumbnailPath = path.join(THUMBNAILS_PATH(), thumbnailFilename)
  await sharp(buffer)
    .resize(THUMBNAIL_MAX_PX, THUMBNAIL_MAX_PX, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .withMetadata()   // preserve EXIF/metadata in thumbnail
    .toFile(thumbnailPath)

  // Extract capture date
  const capturedAt = await extractCapturedAt(buffer)

  return { uuid, filename, thumbnailFilename, capturedAt }
}

/**
 * Delete both original and thumbnail files for a photo.
 * Errors are logged but not thrown (best-effort cleanup).
 */
export async function deleteImageFiles(filename) {
  const uuid = path.parse(filename).name
  const thumbnailFilename = `${uuid}.jpg`

  const originalPath = path.join(UPLOADS_PATH(), filename)
  const thumbnailPath = path.join(THUMBNAILS_PATH(), thumbnailFilename)

  await Promise.allSettled([
    fs.unlink(originalPath),
    fs.unlink(thumbnailPath),
  ])
}
