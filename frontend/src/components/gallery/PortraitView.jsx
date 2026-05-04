import { useRef } from 'react'
import { ActionMenu }   from './ActionMenu.jsx'
import { ReportButton } from './ReportButton.jsx'
import { useSwipe } from '../../hooks/useSwipe.js'
import { useAuth }  from '../../context/AuthContext.jsx'
import styles from './PortraitView.module.css'

/**
 * Mobile single-photo view (FR-G04).
 *
 * – Swipe left/right: navigate photos
 * – Tap photo: open full-screen view (FR-G06)
 * – Grid icon (top-left): switch to grid view (FR-G07)
 * – Uploader name + caption shown below the photo
 */
export function PortraitView({
  photos,
  currentIndex,
  onNavigate,
  onOpenFullScreen,
  onShowGrid,
  onPhotoUpdate,
  onPhotoFlagged,
}) {
  const { user } = useAuth()
  const photo = photos[currentIndex]
  const isOwnPhoto = user && photo.user_id === user.id

  const swipe = useSwipe({
    onSwipeLeft:  () => onNavigate(Math.min(photos.length - 1, currentIndex + 1)),
    onSwipeRight: () => onNavigate(Math.max(0, currentIndex - 1)),
  })

  return (
    <div className={styles.portrait}>

      {/* Grid icon — top-left (FR-G04) */}
      <button
        className={styles.gridIcon}
        onClick={onShowGrid}
        aria-label="Åpne rutenettvisning"
        title="Rutenett"
      >
        ⊞
      </button>

      {/* Counter — top-right */}
      <div className={styles.counter} aria-label={`Bilde ${currentIndex + 1} av ${photos.length}`}>
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Action menu (own photos) or report button — stop propagation */}
      {user && (
        <div className={styles.actionsWrap} onClick={(e) => e.stopPropagation()}>
          {isOwnPhoto ? (
            <ActionMenu
              photo={photo}
              onEditCaption={() => {/* caption editing not available in portrait view */}}
              onFlagged={(id) => onPhotoFlagged?.(id)}
            />
          ) : (
            <ReportButton photo={photo} />
          )}
        </div>
      )}

      {/* Photo — swipeable, tappable for full-screen */}
      <div
        className={styles.photoArea}
        {...swipe}
        onClick={onOpenFullScreen}
      >
        <img
          src={`/api/photos/${photo.id}/thumbnail`}
          alt={photo.caption || photo.original_name || `Bilde ${currentIndex + 1}`}
          className={styles.photo}
          draggable={false}
        />
      </div>

      {/* Caption panel — uploader name + caption (FR-G04) */}
      {(photo.uploader_name || photo.caption) && (
        <div className={styles.captionPanel} onClick={(e) => e.stopPropagation()}>
          {photo.uploader_name && (
            <span className={styles.uploaderName}>{photo.uploader_name}</span>
          )}
          {photo.caption && (
            <p className={styles.caption}>{photo.caption}</p>
          )}
        </div>
      )}
    </div>
  )
}
