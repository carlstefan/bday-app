import { useState } from 'react'
import styles from './PhotoImage.module.css'

/**
 * Unified image component.
 * src='thumbnail' — serves /api/photos/:id/thumbnail
 * src='full'      — loads thumbnail first, swaps to full original when ready
 */
export function PhotoImage({ photo, src = 'thumbnail', alt, className, style, onLoad }) {
  const [fullReady, setFullReady] = useState(false)

  const thumbUrl = `/api/photos/${photo.id}/thumbnail`
  const fullUrl  = `/api/photos/${photo.id}/image`
  const altText  = alt || photo.caption || photo.original_name || 'Party photo'

  if (src === 'thumbnail') {
    return (
      <img
        src={thumbUrl}
        alt={altText}
        className={className}
        style={style}
        loading="lazy"
        onLoad={onLoad}
      />
    )
  }

  // Full: show thumbnail until full is ready
  return (
    <div className={`${styles.fullWrapper} ${className || ''}`} style={style}>
      <img
        src={thumbUrl}
        alt={altText}
        className={`${styles.inner} ${fullReady ? styles.hidden : ''}`}
        aria-hidden={fullReady}
      />
      <img
        src={fullUrl}
        alt={altText}
        className={`${styles.inner} ${fullReady ? '' : styles.invisible}`}
        onLoad={() => { setFullReady(true); onLoad?.() }}
      />
    </div>
  )
}
