import styles from './GridView.module.css'

export function GridView({ photos, currentIndex, onPhotoClick, isMobile, isHiddenMode, onUnhide }) {
  return (
    <div className={styles.grid}>
      {photos.map((photo, idx) => (
        <div
          key={photo.id}
          className={styles.thumb}
          onClick={() => onPhotoClick(idx)}
          role="button"
          tabIndex={0}
          aria-label={`Bilde ${idx + 1}${photo.uploader_name ? ' av ' + photo.uploader_name : ''}`}
          onKeyDown={(e) => e.key === 'Enter' && onPhotoClick(idx)}
        >
          <img
            src={`/api/photos/${photo.id}/thumbnail`}
            alt={photo.caption || photo.uploader_name || `Bilde ${idx + 1}`}
            loading="lazy"
            className={styles.img}
          />

          {/* Caption/uploader overlay */}
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

          {/* Unhide button — hidden gallery mode (admins only) */}
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
