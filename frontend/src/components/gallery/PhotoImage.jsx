import { useState } from 'react'
import styles from './PhotoImage.module.css'

/**
 * Unified image component.
 * src='thumbnail' — serves the party-scoped thumbnail
 * src='full'      — loads thumbnail first, swaps to full original when ready
 *
 * When partyKey is provided, uses /api/p/:partyKey/photos/:id/... routes.
 * Falls back to the legacy /api/photos/:id/... routes when partyKey is absent.
 */
export function PhotoImage({ photo, src = 'thumbnail', alt, className, style, onLoad, partyKey }) {
  const [fullReady, setFullReady] = useState(false)

  const base     = partyKey ? `/api/p/${partyKey}/photos/${photo.id}` : `/api/photos/${photo.id}`
  const thumbUrl = `${base}/thumbnail`
  const fullUrl  = `${base}/image`
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
