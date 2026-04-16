import { useState, useRef } from 'react'
import { PhotoImage } from './PhotoImage.jsx'
import { useSwipe } from '../../hooks/useSwipe.js'
import styles from './PortraitView.module.css'

const GRID_COLS = 2

export function PortraitView({ photos, currentIndex, onNavigate, onOpenFullScreen }) {
  const [showGrid, setShowGrid] = useState(false)
  const gridRef = useRef(null)

  const photo = photos[currentIndex]

  // ── Swipe handlers for single-photo view ────────────────────────────────
  const singleSwipe = useSwipe({
    onSwipeLeft:  () => onNavigate(Math.min(photos.length - 1, currentIndex + 1)),
    onSwipeRight: () => onNavigate(Math.max(0, currentIndex - 1)),
    onSwipeDown:  () => setShowGrid(true),
  })

  // ── Mini-grid view ───────────────────────────────────────────────────────
  if (showGrid) {
    return (
      <div className={styles.gridContainer}>
        <div className={styles.gridHeader}>
          <button className={styles.closeGrid} onClick={() => setShowGrid(false)} aria-label="Back to photo">
            ✕
          </button>
          <span className={styles.gridTitle}>
            {currentIndex + 1} / {photos.length}
          </span>
        </div>

        <div ref={gridRef} className={styles.grid}>
          {photos.map((p, idx) => (
            <div
              key={p.id}
              className={`${styles.gridThumb} ${idx === currentIndex ? styles.gridThumbActive : ''}`}
              onClick={() => {
                onNavigate(idx)
                setShowGrid(false)
              }}
              role="button"
              tabIndex={0}
              aria-label={`Photo ${idx + 1}${p.uploader_name ? ' by ' + p.uploader_name : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onNavigate(idx); setShowGrid(false) }
              }}
            >
              <img
                src={`/api/photos/${p.id}/thumbnail`}
                alt={p.caption || p.original_name}
                loading="lazy"
                className={styles.gridImg}
              />
              {idx === currentIndex && <div className={styles.activeMarker} />}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Single-photo view ────────────────────────────────────────────────────
  return (
    <div
      className={styles.portrait}
      {...singleSwipe}
      onClick={() => onOpenFullScreen()}
    >
      <img
        src={`/api/photos/${photo.id}/thumbnail`}
        alt={photo.caption || photo.original_name}
        className={styles.photo}
        draggable={false}
      />

      {/* Swipe-down hint */}
      <div className={styles.swipeHint} aria-hidden>
        <span>↓</span>
      </div>

      {/* Counter */}
      <div className={styles.counter} aria-label={`Photo ${currentIndex + 1} of ${photos.length}`}>
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  )
}
