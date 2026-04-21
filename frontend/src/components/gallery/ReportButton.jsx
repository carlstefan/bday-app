import { useState } from 'react'
import { api } from '../../api/client.js'
import styles from './ReportButton.module.css'

/**
 * FR-G08: Report button shown on photos the current user does NOT own.
 * Flags the photo for admin review but does NOT remove it from the gallery
 * (only own-photo flags auto-hide).
 *
 * @param {object} photo  The photo object
 */
export function ReportButton({ photo }) {
  const [busy, setBusy]       = useState(false)
  const [reported, setReported] = useState(false)

  async function report(e) {
    e.stopPropagation()
    if (busy || reported) return
    const ok = confirm('Dette vil rapportere bildet til admin for gjennomgang. Vil du fortsette?')
    if (!ok) return
    setBusy(true)
    try {
      await api.post(`/api/photos/${photo.id}/flag`)
      setReported(true)
    } catch (err) {
      if (err.status === 409) {
        setReported(true)
      } else {
        alert(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  if (reported) {
    return (
      <span className={styles.reported} title="Rapportert til admin">
        🚩 <span className={styles.reportedText}>Rapportert</span>
      </span>
    )
  }

  return (
    <button
      className={styles.btn}
      onClick={report}
      disabled={busy}
      title="Rapporter dette bildet"
      aria-label="Rapporter dette bildet"
    >
      {busy ? '…' : '🚩'}
    </button>
  )
}
