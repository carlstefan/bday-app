import { useEffect, useRef } from 'react'
import { PhotoImage } from './PhotoImage.jsx'
import { useSwipe } from '../../hooks/useSwipe.js'
import { useViewport } from '../../hooks/useViewport.js'
import styles from './SushiBar.module.css'

/** How many photos to show at each breakpoint (always odd). */
function visibleCount(width) {
  if (width >= 1280) return 7
  if (width >= 768)  return 5
  return 3
}

export function SushiBar({ photos, currentIndex, onNavigate, onOpenFullScreen }) {
  const { width } = useViewport()
  const containerRef = useRef(null)

  const count    = visibleCount(width)
  const flanking = Math.floor(count / 2)  // 1, 2 or 3

  // ── scroll wheel → navigate (no page scroll) ────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let lastAt = 0
    const DEBOUNCE = 250 // ms

    function onWheel(e) {
      e.preventDefault()
      const now = Date.now()
      if (now - lastAt < DEBOUNCE) return
      lastAt = now
      if (e.deltaY > 0 || e.deltaX > 0) {
        onNavigate(Math.min(photos.length - 1, currentIndex + 1))
      } else {
        onNavigate(Math.max(0, currentIndex - 1))
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [currentIndex, photos.length, onNavigate])

  // ── swipe on mobile ─────────────────────────────────────────────────────
  const swipeHandlers = useSwipe({
    onSwipeLeft:  () => onNavigate(Math.min(photos.length - 1, currentIndex + 1)),
    onSwipeRight: () => onNavigate(Math.max(0, currentIndex - 1)),
  })

  // ── build slot list ─────────────────────────────────────────────────────
  const slots = []
  for (let offset = -flanking; offset <= flanking; offset++) {
    const idx = currentIndex + offset
    slots.push({ offset, idx: idx >= 0 && idx < photos.length ? idx : null })
  }

  return (
    <div
      ref={containerRef}
      className={styles.bar}
      {...swipeHandlers}
    >
      {slots.map(({ offset, idx }) => {
        if (idx === null) {
          return <div key={`empty-${offset}`} className={styles.slot} style={{ '--dist': Math.abs(offset) }} />
        }

        const photo     = photos[idx]
        const isCenter  = offset === 0
        const dist      = Math.abs(offset)
        // Use full image for sushi bar centre at 1024px+
        const imgSrc    = isCenter && width >= 1024 ? 'full' : 'thumbnail'

        return (
          <div
            key={photo.id}
            className={`${styles.slot} ${isCenter ? styles.center : styles.flanking}`}
            style={{ '--dist': dist }}
            onClick={() => isCenter ? onOpenFullScreen() : onNavigate(idx)}
            role="button"
            tabIndex={isCenter ? 0 : -1}
            aria-label={isCenter ? 'Open full-screen' : `Go to photo by ${photo.uploader_name || 'guest'}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                isCenter ? onOpenFullScreen() : onNavigate(idx)
              }
            }}
          >
            <div className={styles.imgWrap}>
              <PhotoImage
                photo={photo}
                src={imgSrc}
                className={styles.img}
              />
            </div>

            {isCenter && (photo.uploader_name || photo.caption) && (
              <div className={styles.info}>
                {photo.uploader_name && (
                  <span className={styles.name}>{photo.uploader_name}</span>
                )}
                {photo.caption && (
                  <p className={styles.caption}>{photo.caption}</p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Nav arrows (desktop) */}
      {currentIndex > 0 && (
        <button
          className={`${styles.arrow} ${styles.arrowLeft}`}
          onClick={() => onNavigate(currentIndex - 1)}
          aria-label="Previous photo"
        >‹</button>
      )}
      {currentIndex < photos.length - 1 && (
        <button
          className={`${styles.arrow} ${styles.arrowRight}`}
          onClick={() => onNavigate(currentIndex + 1)}
          aria-label="Next photo"
        >›</button>
      )}

      {/* Counter */}
      <div className={styles.counter}>
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  )
}
