import { useState, useRef, useEffect } from 'react'
import { api } from '../../api/client.js'
import styles from './ActionMenu.module.css'

/**
 * FR-G10: ⋮ action menu shown on photos the current user owns.
 * Contains: "Edit caption" (triggers parent editing mode) and "Flag for deletion" (auto-hides photo).
 *
 * @param {object}   photo          The photo object
 * @param {function} onEditCaption  Called when user picks "Edit caption"
 * @param {function} onFlagged      Called with photo.id after successful flag (own photo → remove from gallery)
 */
export function ActionMenu({ photo, onEditCaption, onFlagged }) {
  const [open, setOpen]   = useState(false)
  const [busy, setBusy]   = useState(false)
  const [flagged, setFlagged] = useState(false)
  const menuRef           = useRef(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  function handleToggle(e) {
    e.stopPropagation()
    setOpen((o) => !o)
  }

  function handleEditCaption(e) {
    e.stopPropagation()
    setOpen(false)
    onEditCaption?.()
  }

  async function handleFlag(e) {
    e.stopPropagation()
    setOpen(false)
    if (busy || flagged) return
    const ok = confirm('Dette vil skjule bildet ditt og sende det til admin for gjennomgang. Vil du fortsette?')
    if (!ok) return
    setBusy(true)
    try {
      await api.post(`/api/photos/${photo.id}/flag`)
      setFlagged(true)
      onFlagged?.(photo.id)
    } catch (err) {
      if (err.status === 409) {
        setFlagged(true)
      } else {
        alert(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={menuRef} className={styles.wrap} onClick={(e) => e.stopPropagation()}>
      <button
        className={styles.trigger}
        onClick={handleToggle}
        aria-label="Bildevalg"
        aria-expanded={open}
        disabled={busy}
        title="Bildevalg"
      >
        {busy ? '…' : '⋮'}
      </button>

      {open && (
        <div className={styles.dropdown} role="menu">
          <button className={styles.item} role="menuitem" onClick={handleEditCaption}>
            <span className={styles.itemIcon} aria-hidden>✎</span>
            Rediger bildetekst
          </button>
          <button
            className={`${styles.item} ${styles.itemDanger}`}
            role="menuitem"
            onClick={handleFlag}
            disabled={flagged}
          >
            <span className={styles.itemIcon} aria-hidden>🚩</span>
            {flagged ? 'Rapportert' : 'Rapporter bildet'}
          </button>
        </div>
      )}
    </div>
  )
}
