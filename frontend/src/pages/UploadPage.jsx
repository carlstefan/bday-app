import { useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useParty } from '../context/PartyContext.jsx'
import { api } from '../api/client.js'
import styles from './UploadPage.module.css'

const MAX_FILES = 20
const MAX_FILE_SIZE = 50 * 1024 * 1024  // 50 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])

export default function UploadPage() {
  const { user, refetch: refreshUser } = useAuth()
  const { partyKey } = useParams()
  const partyCtx = useParty()
  const party = partyCtx?.party ?? null
  const fileInputRef = useRef(null)

  // FR-G15: first-visit join banner (non-blocking on upload page)
  const hasRole = user?.is_super_admin || (user?.party_roles || []).some(r => r.party_key === partyKey)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [joining, setJoining] = useState(false)
  const showBanner = user && partyKey && !hasRole && !bannerDismissed

  async function handleJoin() {
    setJoining(true)
    try {
      await api.post(`/api/parties/${partyKey}/join`)
      await refreshUser()
      setBannerDismissed(true)
    } catch (err) {
      alert(err.message)
    } finally {
      setJoining(false)
    }
  }

  const [files, setFiles]               = useState([])
  const [uploaderName, setUploaderName] = useState(user?.display_name || '')
  const [caption, setCaption]           = useState('')
  const [dragOver, setDragOver]         = useState(false)
  const [progress, setProgress]         = useState(null)  // 0-100 or null
  const [result, setResult]             = useState(null)  // { uploaded } or null
  const [error, setError]               = useState('')

  function validateFiles(incoming) {
    const valid = []
    const errors = []

    for (const f of incoming) {
      if (!ALLOWED_TYPES.has(f.type)) {
        errors.push(`${f.name}: filtype ikke støttet (kun JPEG, PNG, HEIC, WebP).`)
        continue
      }
      if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name}: for stor (maks 50 MB per fil).`)
        continue
      }
      valid.push(f)
    }

    return { valid, errors }
  }

  function addFiles(incoming) {
    setError('')
    const all = [...files, ...Array.from(incoming)]
    if (all.length > MAX_FILES) {
      setError(`Maks ${MAX_FILES} bilder per opplasting.`)
      return
    }
    const { valid, errors } = validateFiles(Array.from(incoming))
    if (errors.length) {
      setError(errors.join('\n'))
      return
    }
    setFiles((prev) => {
      const combined = [...prev, ...valid]
      return combined.slice(0, MAX_FILES)
    })
  }

  function handleFileInput(e) {
    addFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (files.length === 0) {
      setError('Velg minst ett bilde.')
      return
    }

    setError('')
    setProgress(0)
    setResult(null)

    const formData = new FormData()
    if (uploaderName.trim()) formData.append('uploader_name', uploaderName.trim())
    if (caption.trim())      formData.append('caption', caption.trim())
    files.forEach((f) => formData.append('photos', f))

    const uploadUrl = partyKey ? `/api/p/${partyKey}/photos` : '/api/photos'
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.withCredentials = true

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status === 201) {
        const data = JSON.parse(xhr.responseText)
        setResult(data)
        setFiles([])
        setCaption('')
        setProgress(null)
      } else if (xhr.status === 507) {
        setError('Galleriet er fullt. Ta kontakt med Carl Stefan eller Trude.')
        setProgress(null)
      } else {
        try {
          const data = JSON.parse(xhr.responseText)
          setError(data.error || 'Opplasting feilet.')
        } catch {
          setError('Opplasting feilet.')
        }
        setProgress(null)
      }
    }

    xhr.onerror = () => {
      setError('Nettverksfeil. Prøv igjen.')
      setProgress(null)
    }

    xhr.send(formData)
  }

  // FR-G13: Submissions closed for this party
  if (party?.submissions_open === false) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.submissionsClosedMsg}>
            Arrangøren tillater for øyeblikket ikke opplastinger.
          </p>
          <p className={styles.backLink}>
            <Link to="/">← Tilbake til forsiden</Link>
          </p>
        </div>
      </div>
    )
  }

  // FR-G13: Anonymous uploads disabled and user not logged in
  if (party?.anonymous_uploads_enabled === false && !user) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.anonDisabledMsg}>
            Anonym opplasting er ikke aktivert for denne festen.{' '}
            <Link to="/login">Logg inn for å laste opp bilder →</Link>
          </p>
          <p className={styles.backLink}>
            <Link to="/">← Tilbake til forsiden</Link>
          </p>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className={styles.page}>
        <div className={styles.success}>
          <div className={styles.successIcon}>🎉</div>
          <h2>Takk!</h2>
          <p>
            {result.uploaded} bilde{result.uploaded !== 1 ? 'r' : ''} lastet opp.
          </p>

          <div className={styles.successActions}>
            <button className={styles.btnPrimary} onClick={() => setResult(null)}>
              Last opp flere bilder
            </button>

            {user ? (
              <Link to={partyKey ? `/p/${partyKey}/gallery` : '/gallery'} className={styles.btnSecondary}>Se galleriet</Link>
            ) : (
              <div className={styles.nudge}>
                <p>
                  <strong>Vil du se bildene fra festen?</strong>
                  <br />
                  <Link to={partyKey ? `/login?next=${encodeURIComponent(`/p/${partyKey}/gallery`)}` : '/login?next=/gallery'}>
                    Logg inn for å se galleriet →
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* FR-G15: First-visit banner — shown above form, does not block upload */}
      {showBanner && (
        <div className={styles.welcomeBanner}>
          <p>
            Hei, {user.display_name}! Du besøker <strong>{party?.name || partyKey}</strong> for første gang.
            Vil du bli med og få tilgang til galleriet?
          </p>
          <div className={styles.welcomeActions}>
            <button className={styles.joinBtn} onClick={handleJoin} disabled={joining}>
              {joining ? '…' : 'Bli med på festen'}
            </button>
            <button className={styles.dismissBtn} onClick={() => setBannerDismissed(true)}>
              Ikke nå
            </button>
          </div>
        </div>
      )}

      <div className={styles.container}>
        <h1 className={styles.title}>Last opp bilder</h1>
        <p className={styles.subtitle}>Del dine minner fra festen!</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Drop zone */}
          <div
            className={`${styles.dropZone} ${dragOver ? styles.dragOver : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
              onChange={handleFileInput}
              className={styles.hiddenInput}
            />
            <div className={styles.dropZoneContent}>
              <span className={styles.dropIcon}>📁</span>
              <span>Klikk eller dra bilder hit</span>
              <span className={styles.dropHint}>JPEG, PNG, HEIC, WebP — maks 50 MB per fil, {MAX_FILES} bilder totalt</span>
            </div>
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <ul className={styles.fileList}>
              {files.map((f, i) => (
                <li key={i} className={styles.fileItem}>
                  <span className={styles.fileName}>{f.name}</span>
                  <span className={styles.fileSize}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeFile(i)}
                    aria-label={`Fjern ${f.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Optional fields */}
          <label className={styles.label}>
            Ditt navn (valgfritt)
            <input
              className={styles.input}
              type="text"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              maxLength={60}
              placeholder="Ola Nordmann"
            />
          </label>

          <label className={styles.label}>
            Bildetekst (valgfritt)
            <textarea
              className={styles.textarea}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              placeholder="Hva skjer på bildet?"
              rows={3}
            />
            <span className={styles.charCount}>{caption.length}/200</span>
          </label>

          {/* Error */}
          {error && (
            <p className={styles.error} style={{ whiteSpace: 'pre-line' }}>{error}</p>
          )}

          {/* Progress bar */}
          {progress !== null && (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              <span className={styles.progressLabel}>{progress}%</span>
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={progress !== null || files.length === 0}
          >
            {progress !== null ? `Laster opp… ${progress}%` : `Last opp ${files.length > 0 ? files.length + ' bilde' + (files.length > 1 ? 'r' : '') : ''}`}
          </button>

          {/* FR-G11: Upload consent notice */}
          <p className={styles.consentNotice}>
            Ved å laste opp bilder godtar du at arrangøren kan bruke dem til private formål, inkludert på egne private sosiale medier.
          </p>
        </form>

        <p className={styles.backLink}>
          <Link to={partyKey ? `/p/${partyKey}` : '/'}>← Tilbake til forsiden</Link>
        </p>
      </div>
    </div>
  )
}
