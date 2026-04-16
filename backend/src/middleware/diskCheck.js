import fs from 'fs/promises'

const WARN_THRESHOLD = 0.90   // 90% used — log warning
const BLOCK_THRESHOLD = 0.95  // 95% used — reject upload

export async function diskCheck(req, res, next) {
  try {
    const uploadsPath = process.env.UPLOADS_PATH || './uploads'
    const stats = await fs.statfs(uploadsPath)

    const total = stats.blocks * stats.bsize
    const free = stats.bfree * stats.bsize
    const used = (total - free) / total

    if (used >= BLOCK_THRESHOLD) {
      console.warn(`[diskCheck] Disk usage at ${(used * 100).toFixed(1)}% — blocking upload.`)
      return res.status(507).json({
        error: 'The gallery is full. Please contact the hosts.',
      })
    }

    if (used >= WARN_THRESHOLD) {
      console.warn(`[diskCheck] Disk usage at ${(used * 100).toFixed(1)}% — nearing capacity.`)
    }

    next()
  } catch (err) {
    // If we can't stat the disk, allow the upload but log the error
    console.error('[diskCheck] Could not check disk space:', err.message)
    next()
  }
}
