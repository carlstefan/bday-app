import multer from 'multer'

const MAX_FILE_SIZE = 50 * 1024 * 1024  // 50 MB
const MAX_FILES = 20

// Magic byte signatures for allowed image types
const MAGIC_BYTES = {
  jpeg: [
    [0xFF, 0xD8, 0xFF],
  ],
  png: [
    [0x89, 0x50, 0x4E, 0x47],
  ],
  webp: [
    // RIFF....WEBP
    { offsets: [0, 1, 2, 3, 8, 9, 10, 11], bytes: [0x52, 0x49, 0x46, 0x46, 0x57, 0x45, 0x42, 0x50] },
  ],
  heic: [
    // ftyp box — bytes 4-7 are 'ftyp'; brand at 8-11 is heic/heix/hevc etc.
    { offsets: [4, 5, 6, 7], bytes: [0x66, 0x74, 0x79, 0x70] },
  ],
}

function checkMagicBytes(buffer) {
  const buf = buffer.slice(0, 12)

  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true

  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true

  // WebP: RIFF at 0-3, WEBP at 8-11
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true

  // HEIC/HEIF: 'ftyp' at bytes 4-7
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return true

  return false
}

const ALLOWED_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
])

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`))
    }
  },
}).array('photos', MAX_FILES)

// Wrap multer to handle its errors gracefully and check magic bytes
export function handleUpload(req, res, next) {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'One or more files exceed the 50 MB limit.' })
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Maximum 20 files per upload.' })
      }
      return res.status(400).json({ error: err.message })
    }
    if (err) {
      return res.status(400).json({ error: err.message })
    }

    // Secondary magic-byte validation on each file
    const invalid = (req.files || []).find((f) => !checkMagicBytes(f.buffer))
    if (invalid) {
      return res.status(400).json({ error: `File "${invalid.originalname}" does not appear to be a valid image.` })
    }

    next()
  })
}
