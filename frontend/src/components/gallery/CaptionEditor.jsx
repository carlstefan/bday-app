import { useState, useRef, useEffect } from 'react'
import { api } from '../../api/client.js'
import styles from './CaptionEditor.module.css'

/**
 * Shown on the sushi bar centre photo when the viewer owns the photo.
 * Displays caption as tap-to-edit inline textarea.
 */
export function CaptionEditor({ photo, onSaved }) {
  const [editing, setEditing]   = useState(false)
  const [value, setValue]       = useState(photo.caption || '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const textareaRef             = useRef(null)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  // Keep value in sync if parent updates photo
  useEffect(() => {
    if (!editing) setValue(photo.caption || '')
  }, [photo.caption, editing])

  async function save() {
    setSaving(true)
    setError('')
    try {
      await api.patch(`/api/photos/${photo.id}/caption`, { json: { caption: value } })
      onSaved?.(photo.id, value)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setValue(photo.caption || '')
    setError('')
    setEditing(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') cancel()
  }

  if (!editing) {
    return (
      <div
        className={styles.display}
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
        title="Klikk for å redigere bildetekst"
      >
        {value
          ? <span className={styles.text}>{value}</span>
          : <span className={styles.placeholder}>+ Legg til bildetekst</span>
        }
        <span className={styles.editIcon} aria-hidden>✎</span>
      </div>
    )
  }

  return (
    <div className={styles.editor} onClick={(e) => e.stopPropagation()}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={200}
        rows={2}
        placeholder="Bildetekst…"
      />
      <div className={styles.controls}>
        {error && <span className={styles.error}>{error}</span>}
        <span className={styles.charCount}>{value.length}/200</span>
        <button className={styles.cancelBtn} onClick={cancel} disabled={saving}>Avbryt</button>
        <button className={styles.saveBtn}   onClick={save}   disabled={saving}>
          {saving ? '…' : 'Lagre'}
        </button>
      </div>
    </div>
  )
}
