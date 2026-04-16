import { useEffect, useRef } from 'react'
import { PhotoImage } from './PhotoImage.jsx'
import { usePinchZoom } from '../../hooks/usePinchZoom.js'
import styles from './FullScreenView.module.css'

export function FullScreenView({ photos, currentIndex, onNavigate, onClose }) {
  const photo     = photos[currentIndex]
  const containerRef = useRef(null)

  const { transform, reset, handlers, onWheel } = usePinchZoom({
    onPrev:    () => { reset(); onNavigate(Math.max(0, currentIndex - 1)) },
    onNext:    () => { reset(); onNavigate(Math.min(photos.length - 1, currentIndex + 1)) },
    onDismiss: onClose,
  })

  // Attach wheel listener (non-passive, so we can preventDefault)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // Reset zoom whenever photo changes
  useEffect(() => { reset() }, [currentIndex, reset])

  // Keyboard: arrows + Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')      onClose()
      if (e.key === 'ArrowLeft')   { reset(); onNavigate(Math.max(0, currentIndex - 1)) }
      if (e.key === 'ArrowRight')  { reset(); onNavigate(Math.min(photos.length - 1, currentIndex + 1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex, photos.length, onNavigate, onClose, reset])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const isZoomed = transform.scale > 1.05

  return (
    <div
      ref={containerRef}
      className={styles.overlay}
      {...handlers}
    >
      {/* Dismiss backdrop tap (when not zoomed) */}
      <div
        className={styles.backdrop}
        onClick={isZoomed ? undefined : onClose}
        aria-hidden
      />

      {/* Image */}
      <div
        className={styles.imageWrap}
        style={{
          transform:    `scale(${transform.scale}) translate(${transform.x / transform.scale}px, ${transform.y / transform.scale}px)`,
          cursor:       isZoomed ? 'grab' : 'zoom-out',
          touchAction:  'none',
        }}
      >
        <PhotoImage
          photo={photo}
          src="full"
          className={styles.image}
        />
      </div>

      {/* Top bar */}
      <div className={styles.topBar}>
        <span className={styles.counter}>{currentIndex + 1} / {photos.length}</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* Prev / Next buttons (no nav when zoomed) */}
      {!isZoomed && (
        <>
          {currentIndex > 0 && (
            <button
              className={`${styles.navBtn} ${styles.prev}`}
              onClick={() => { reset(); onNavigate(currentIndex - 1) }}
              aria-label="Previous photo"
            >‹</button>
          )}
          {currentIndex < photos.length - 1 && (
            <button
              className={`${styles.navBtn} ${styles.next}`}
              onClick={() => { reset(); onNavigate(currentIndex + 1) }}
              aria-label="Next photo"
            >›</button>
          )}
        </>
      )}

      {/* Zoom indicator */}
      {isZoomed && (
        <button className={styles.resetZoom} onClick={reset} aria-label="Reset zoom">
          1:1 reset
        </button>
      )}
    </div>
  )
}
