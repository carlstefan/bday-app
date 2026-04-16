import { useState } from 'react'
import { api } from '../../api/client.js'
import styles from './FlagButton.module.css'

/**
 * Shown on photos the current user doesn't own.
 * Flags the photo for admin review and removes it from the gallery list.
 */
export function FlagButton({ photo, onFlagged }) {
  const [busy, setBusy]       = useState(false)
  const [flagged, setFlagged] = useState(false)

  async function flag(e) {
    e.stopPropagation()  // don't trigger full-screen open
    if (busy || flagged) return
    const ok = confirm(
      'Dette vil skjule bildet inntil en admin har sett på det. Vil du fortsette?'
    )
    if (!ok) return
    setBusy(true)
    try {
      await api.post(`/api/photos/${photo.id}/flag`)
      setFlagged(true)
      onFlagged?.(photo.id)
    } catch (err) {
      if (err.status === 409) {
        // Already flagged
        setFlagged(true)
      } else {
        alert(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  if (flagged) {
    return (
      <span className={styles.flagged} title="Rapportert til admin">
        🚩
      </span>
    )
  }

  return (
    <button
      className={styles.btn}
      onClick={flag}
      disabled={busy}
      title="Rapporter dette bildet"
      aria-label="Rapporter dette bildet"
    >
      {busy ? '…' : '🚩'}
    </button>
  )
}
