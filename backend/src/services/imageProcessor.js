import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const UPLOADS_PATH   = () => process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads')
const THUMBNAILS_DIR = (uploadsDir) => path.join(uploadsDir, 'thumbnails')

const THUMBNAIL_MAX_PX = 1000
const THUMBNAIL_QUALITY = 85

const EXT_MAP = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
}

async function extractCapturedAt(buffer) {
  try {
    const metadata = await sharp(buffer).metadata()
    const exif = metadata.exif
    if (!exif) return null
    const exifStr = exif.toString('binary')
    const match = exifStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
    if (!match) return null
    const [, year, month, day, hour, min, sec] = match
    return `${year}-${month}-${day}T${hour}:${min}:${sec}`
  } catch {
    return null
  }
}

/**
 * Resolve the uploads directory for a party.
 * When partyKey is provided, files go into uploads/{partyKey}/.
 * Falls back to the flat uploads/ root for legacy / unscoped use.
 */
function resolveUploadsDir(partyKey) {
  const base = UPLOADS_PATH()
  return partyKey ? path.join(base, partyKey) : base
}

function resolveThumbnailsDir(partyKey) {
  const base = UPLOADS_PATH()
  return partyKey ? path.join(base, 'thumbnails', partyKey) : path.join(base, 'thumbnails')
}

/**
 * Process a single uploaded file:
 *  1. Write original to disk (UUID filename, party-scoped directory)
 *  2. Generate 1000px JPEG thumbnail
 *  3. Extract captured_at from EXIF
 *
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {string} originalName
 * @param {string|null} partyKey  - when set, files go into uploads/{partyKey}/
 */
export async function processImage(buffer, mimetype, originalName, partyKey = null) {
  const ext = EXT_MAP[mimetype] || 'jpg'
  const uuid = uuidv4()
  const filename = `${uuid}.${ext}`
  const thumbnailFilename = `${uuid}.jpg`

  const uploadsDir   = resolveUploadsDir(partyKey)
  const thumbnailsDir = resolveThumbnailsDir(partyKey)

  await fs.mkdir(uploadsDir,    { recursive: true })
  await fs.mkdir(thumbnailsDir, { recursive: true })

  const originalPath  = path.join(uploadsDir, filename)
  const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename)

  await fs.writeFile(originalPath, buffer)

  await sharp(buffer)
    .resize(THUMBNAIL_MAX_PX, THUMBNAIL_MAX_PX, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .withMetadata()
    .toFile(thumbnailPath)

  const capturedAt = await extractCapturedAt(buffer)

  return { uuid, filename, thumbnailFilename, capturedAt }
}

/**
 * Delete both original and thumbnail files for a photo.
 *
 * @param {string} filename   - UUID filename (e.g. "abc123.jpg")
 * @param {string|null} partyKey
 */
export async function deleteImageFiles(filename, partyKey = null) {
  const uuid = path.parse(filename).name
  const thumbnailFilename = `${uuid}.jpg`

  const uploadsDir    = resolveUploadsDir(partyKey)
  const thumbnailsDir = resolveThumbnailsDir(partyKey)

  const originalPath  = path.join(uploadsDir, filename)
  const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename)

  await Promise.allSettled([
    fs.unlink(originalPath),
    fs.unlink(thumbnailPath),
  ])
}

/**
 * Resolve the full filesystem path for a photo's original file.
 */
export function resolveOriginalPath(filename, partyKey = null) {
  return path.join(resolveUploadsDir(partyKey), filename)
}

/**
 * Resolve the full filesystem path for a photo's thumbnail.
 */
export function resolveThumbnailPath(filename, partyKey = null) {
  const uuid = path.parse(filename).name
  return path.join(resolveThumbnailsDir(partyKey), `${uuid}.jpg`)
}
