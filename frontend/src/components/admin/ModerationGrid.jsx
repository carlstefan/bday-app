import { useState } from 'react'
import { api } from '../../api/client.js'
import styles from './ModerationGrid.module.css'

export function ModerationGrid({ photos, onUpdate }) {
  const [busy, setBusy] = useState({})

  async function toggle(photo) {
    if (busy[photo.id]) return
    setBusy((b) => ({ ...b, [photo.id]: true }))
    try {
      const action = photo.is_hidden ? 'unhide' : 'hide'
      await api.patch(`/api/admin/photos/${photo.id}/${action}`)
      onUpdate(photo.id, { is_hidden: !photo.is_hidden })
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy((b) => ({ ...b, [photo.id]: false }))
    }
  }

  if (photos.length === 0) {
    return <p className={styles.empty}>Ingen bilder ennå.</p>
  }

  return (
    <div className={styles.grid}>
      {photos.map((photo) => (
        <div
          key={photo.id}
          className={`${styles.card} ${photo.is_hidden ? styles.hidden : ''} ${photo.has_pending_flag ? styles.flagged : ''}`}
        >
          <div className={styles.imgWrap}>
            <img
              src={`/api/photos/${photo.id}/thumbnail`}
              alt={photo.caption || photo.original_name}
              loading="lazy"
              className={styles.img}
            />
            {photo.is_hidden && <div className={styles.hiddenBadge}>Skjult</div>}
            {photo.has_pending_flag && <div className={styles.flagBadge}>🚩 Flagget</div>}
          </div>

          <div className={styles.meta}>
            {photo.uploader_name && <span className={styles.uploader}>{photo.uploader_name}</span>}
            {photo.caption && <p className={styles.caption}>{photo.caption}</p>}
          </div>

          <button
            className={`${styles.toggleBtn} ${photo.is_hidden ? styles.unhideBtn : styles.hideBtn}`}
            onClick={() => toggle(photo)}
            disabled={!!busy[photo.id]}
          >
            {busy[photo.id] ? '…' : photo.is_hidden ? 'Vis igjen' : 'Skjul'}
          </button>
        </div>
      ))}
    </div>
  )
}
