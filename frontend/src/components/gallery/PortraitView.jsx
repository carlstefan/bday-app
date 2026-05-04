import { ActionMenu }   from './ActionMenu.jsx'
import { ReportButton } from './ReportButton.jsx'
import { useSwipe } from '../../hooks/useSwipe.js'
import { useAuth }  from '../../context/AuthContext.jsx'
import styles from './PortraitView.module.css'

export function PortraitView({
  photos, currentIndex, onNavigate, onShowGrid,
  onOpenFullScreen, onPhotoUpdate, onPhotoFlagged,
}) {
  const { user } = useAuth()
  const photo = photos[currentIndex]

  const swipeHandlers = useSwipe({
    onSwipeLeft:  () => onNavigate(Math.min(photos.length - 1, currentIndex + 1)),
    onSwipeRight: () => onNavigate(Math.max(0, currentIndex - 1)),
  })

  const isOwnPhoto = user && photo.user_id === user.id

  return (
    <div className={styles.portrait}>

      {/* Top bar: grid icon left · counter centre · action menu right */}
      <div className={styles.topBar}>
        <button className={styles.gridIcon} onClick={onShowGrid} aria-label="Vis rutenett">
          ⊞
        </button>
        <span className={styles.counter} aria-label={`Bilde ${currentIndex + 1} av ${photos.length}`}>
          {currentIndex + 1} / {photos.length}
        </span>
        {user && (
          <div onClick={(e) => e.stopPropagation()}>
            {isOwnPhoto ? (
              <ActionMenu
                photo={photo}
                onEditCaption={() => {}}
                onFlagged={(id) => onPhotoFlagged?.(id)}
              />
            ) : (
              <ReportButton photo={photo} />
            )}
          </div>
        )}
        {!user && <div style={{ width: 40 }} />}
      </div>

      {/* Photo area — swipe to navigate, tap to open full-screen */}
      <div
        className={styles.photoArea}
        {...swipeHandlers}
        onClick={() => onOpenFullScreen()}
      >
        <img
          src={`/api/photos/${photo.id}/thumbnail`}
          alt={photo.caption || photo.uploader_name || `Bilde ${currentIndex + 1}`}
          className={styles.photo}
          draggable={false}
        />
      </div>

      {/* Caption panel */}
      {(photo.uploader_name || photo.caption) && (
        <div className={styles.captionPanel}>
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
