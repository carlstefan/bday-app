import styles from './GridView.module.css'

export function GridView({ photos, currentIndex, onSelect }) {
  return (
    <div className={styles.grid}>
      {photos.map((photo, idx) => (
        <div
          key={photo.id}
          className={`${styles.thumb} ${idx === currentIndex ? styles.active : ''}`}
          onClick={() => onSelect(idx)}
          role="button"
          tabIndex={0}
          aria-label={`Photo ${idx + 1}${photo.uploader_name ? ' by ' + photo.uploader_name : ''}`}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(idx)}
        >
          <img
            src={`/api/photos/${photo.id}/thumbnail`}
            alt={photo.caption || photo.original_name}
            loading="lazy"
            className={styles.img}
          />
          {idx === currentIndex && <div className={styles.activeRing} aria-hidden />}
        </div>
      ))}
    </div>
  )
}
