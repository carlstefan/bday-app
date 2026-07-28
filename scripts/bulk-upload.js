#!/usr/bin/env node
/**
 * Bulk-uploads a folder of photos to the party site, working around the
 * 20-files-per-request server limit (backend/src/middleware/upload.js).
 *
 * This goes through the normal POST /api/p/:partyKey/photos endpoint —
 * the same one the browser upload form uses — so the database and the
 * files on disk are guaranteed to stay in sync (UUID renaming, thumbnail
 * generation, and EXIF captured_at extraction all happen server-side,
 * per file, as part of the same request that inserts the DB row).
 *
 * Usage:
 *   BASE_URL=http://10.0.0.12:8081 \
 *   PARTY_KEY=tcs \
 *   UPLOAD_USERNAME=<your local-auth username> \
 *   UPLOAD_PASSWORD=<your local-auth password> \
 *   UPLOADER_NAME="Carl Stefan" \
 *   node scripts/bulk-upload.js "F:\Pictures\Bday 100"
 *
 * Notes:
 *   - Requires Node 20+ (uses global fetch/FormData/Blob — same engine
 *     requirement as the rest of the backend).
 *   - Only needs an authenticated account with at least "guest" role on
 *     the party (or run with anonymous_uploads_enabled and omit login —
 *     see ANONYMOUS below).
 *   - Files are uploaded in batches, capped at 20 files (the server's hard
 *     multer limit) AND at a total size well under nginx's
 *     client_max_body_size (55m — see nginx/nginx.prod.conf), with a short
 *     delay between batches. At 300 uploads/hour allowed per IP, well under
 *     100 batches finishes comfortably within the rate limit.
 *   - Hidden files and macOS AppleDouble sidecar files (names starting
 *     with "._", created when copying from an SD card / external drive
 *     through Finder) are skipped automatically.
 */
import fs from 'fs'
import path from 'path'

const BASE_URL   = process.env.BASE_URL   || 'http://10.0.0.12:8081'
const PARTY_KEY  = process.env.PARTY_KEY  || 'tcs'
const USERNAME   = process.env.UPLOAD_USERNAME
const PASSWORD   = process.env.UPLOAD_PASSWORD
const ANONYMOUS  = process.env.ANONYMOUS === '1'
const UPLOADER   = process.env.UPLOADER_NAME || ''
const CAPTION    = process.env.CAPTION || ''
const MAX_FILES_PER_BATCH = 20                // server hard limit — see middleware/upload.js MAX_FILES
const MAX_BATCH_BYTES     = 40 * 1024 * 1024  // stay well under nginx client_max_body_size (55m)
const DELAY_MS            = 1500              // gap between batches, stays well under the 300/hr limiter

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'])

const MIME_TYPES = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.webp': 'image/webp',
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Groups files into batches respecting both the server's per-request file
// count limit and a total-byte cap (nginx rejects oversized request bodies
// with a 413 before the request even reaches the app).
function chunkBySize(filePaths) {
  const out = []
  let current = []
  let currentBytes = 0

  for (const filePath of filePaths) {
    const size = fs.statSync(filePath).size
    const wouldExceed = current.length >= MAX_FILES_PER_BATCH || (current.length > 0 && currentBytes + size > MAX_BATCH_BYTES)
    if (wouldExceed) {
      out.push(current)
      current = []
      currentBytes = 0
    }
    current.push(filePath)
    currentBytes += size
  }
  if (current.length > 0) out.push(current)
  return out
}

async function login() {
  if (!USERNAME || !PASSWORD) {
    throw new Error('Set UPLOAD_USERNAME and UPLOAD_PASSWORD (or run with ANONYMOUS=1 if the party allows anonymous uploads).')
  }
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${text}`)

  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error('Login succeeded but no session cookie was returned.')
  return setCookie.split(';')[0]
}

async function uploadBatch(cookie, files, batchNum, totalBatches) {
  const form = new FormData()
  for (const filePath of files) {
    const buf = fs.readFileSync(filePath)
    const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    form.append('photos', new Blob([buf], { type: mimeType }), path.basename(filePath))
  }
  if (UPLOADER) form.append('uploader_name', UPLOADER)
  if (CAPTION) form.append('caption', CAPTION)

  const headers = cookie ? { Cookie: cookie } : {}
  const res = await fetch(`${BASE_URL}/api/p/${PARTY_KEY}/photos`, {
    method: 'POST',
    headers,
    body: form,
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`Batch ${batchNum}/${totalBatches} FAILED (${res.status}): ${text}`)
    return false
  }

  let data
  try { data = JSON.parse(text) } catch { data = {} }
  console.log(`Batch ${batchNum}/${totalBatches}: uploaded ${data.uploaded ?? files.length} photo(s)`)
  return true
}

async function main() {
  const dir = process.argv[2]
  if (!dir) {
    console.error('Usage: node scripts/bulk-upload.js <folder>')
    process.exit(1)
  }
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`Not a directory: ${dir}`)
    process.exit(1)
  }

  const allEntries = fs.readdirSync(dir)
  const skipped = allEntries.filter((name) => name.startsWith('.'))
  const files = allEntries
    .filter((name) => !name.startsWith('.'))
    .filter((name) => ALLOWED_EXT.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(dir, name))
    .sort()

  if (skipped.length) {
    console.log(`Skipping ${skipped.length} hidden/sidecar file(s): ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? ', ...' : ''}`)
  }
  if (files.length === 0) {
    console.error('No image files found matching', [...ALLOWED_EXT].join(', '))
    process.exit(1)
  }

  console.log(`Found ${files.length} image(s) in ${dir}`)

  let cookie = null
  if (!ANONYMOUS) {
    console.log('Logging in...')
    cookie = await login()
    console.log('Logged in.')
  }

  const batches = chunkBySize(files)
  console.log(`Uploading in ${batches.length} batch(es) (up to ${MAX_FILES_PER_BATCH} files / ${Math.round(MAX_BATCH_BYTES / 1024 / 1024)}MB each)...`)

  const failed = []
  for (let i = 0; i < batches.length; i++) {
    const ok = await uploadBatch(cookie, batches[i], i + 1, batches.length)
    if (!ok) failed.push(...batches[i])
    if (i < batches.length - 1) await sleep(DELAY_MS)
  }

  if (failed.length) {
    console.log(`\n${failed.length} file(s) failed to upload:`)
    failed.forEach((f) => console.log(' -', f))
    process.exitCode = 1
  } else {
    console.log('\nAll batches uploaded successfully.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
