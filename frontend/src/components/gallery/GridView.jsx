import styles from './GridView.module.css'

/**
 * Responsive photo grid (FR-G07).
 *
 * onPhotoClick(idx) — called when a thumbnail is tapped.
 *   On desktop (>=480px): opens full-screen view directly.
 *   On mobile (<480px):   returns to single-photo view at that photo.
 * isMobile        — used for accessible label only (UX is driven by parent)
 * isHiddenMode    — when true, shows an "Unhide" button on each thumbnail
 * onUnhide(id)    — called when admin clicks "Unhide" on a thumbnail
 */
export function GridView({ photos, currentIndex, onPhotoClick, isMobile, isHiddenMode, onUnhide }) {
  return (
    <div className={styles.grid}>
      {photos.map((photo, idx) => (
        <div
          key={photo.id}
          className={`${styles.thumb} ${idx === currentIndex ? styles.thumbCurrent : ''}`}
          onClick={() => onPhotoClick(idx)}
          role="button"
          tabIndex={0}
          aria-label={
            `${isMobile ? 'Åpne' : 'Vis'} bilde ${idx + 1}` +
            (photo.uploader_name ? ` av ${photo.uploader_name}` : '')
          }
          onKeyDown={(e) => e.key === 'Enter' && onPhotoClick(idx)}
        >
          <img
            src={`/api/photos/${photo.id}/thumbnail`}
            alt={photo.caption || photo.original_name || `Bilde ${idx + 1}`}
            loading="lazy"
            className={styles.img}
          />

          {/* Caption + uploader name overlay — bottom gradient */}
          {(photo.uploader_name || photo.caption) && (
            <div className={styles.captionOverlay}>
              {photo.uploader_name && (
                <span className={styles.uploaderName}>{photo.uploader_name}</span>
              )}
              {photo.caption && (
                <p className={styles.caption}>{photo.caption}</p>
              )}
            </div>
          )}

          {/* Hidden gallery: per-thumbnail unhide button (FR-A05) */}
          {isHiddenMode && onUnhide && (
            <button
              className={styles.unhideBtn}
              onClick={(e) => { e.stopPropagation(); onUnhide(photo.id) }}
              aria-label="Vis frem igjen"
            >
              Vis frem
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
