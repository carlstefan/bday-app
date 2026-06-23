import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { PhotoImage } from './PhotoImage.jsx'
import { FlagButton } from './FlagButton.jsx'
import { usePinchZoom } from '../../hooks/usePinchZoom.js'
import ThreeDotMenu from '../ThreeDotMenu.jsx'
import styles from './FullScreenView.module.css'

const AUTOHIDE_MS = 2500

export function FullScreenView({ photos, currentIndex, onNavigate, onClose, user, onFlag }) {
  const photo        = photos[currentIndex]
  const containerRef = useRef(null)
  const { partyKey } = useParams()

  // ── Overlay auto-hide ─────────────────────────────────────────────────────
  const [overlayVisible, setOverlayVisible] = useState(true)
  const hideTimer = useRef(null)

  const showOverlay = useCallback(() => {
    setOverlayVisible(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setOverlayVisible(false), AUTOHIDE_MS)
  }, [])

  useEffect(() => {
    showOverlay()
    return () => clearTimeout(hideTimer.current)
  }, [showOverlay, currentIndex])

  // ── Pinch/swipe/zoom ──────────────────────────────────────────────────────
  const { transform, isInteracting, reset, handlers, onWheel } = usePinchZoom({
    onPrev:    () => { reset(); onNavigate(Math.max(0, currentIndex - 1)) },
    onNext:    () => { reset(); onNavigate(Math.min(photos.length - 1, currentIndex + 1)) },
    onDismiss: onClose,
  })

  // Preload the neighboring full-size images so prev/next feels instant
  // instead of waiting on a fresh network request each time.
  useEffect(() => {
    const base = partyKey ? `/api/p/${partyKey}/photos` : '/api/photos'
    ;[currentIndex - 1, currentIndex + 1].forEach((i) => {
      const neighbor = photos[i]
      if (!neighbor) return
      const img = new Image()
      img.src = `${base}/${neighbor.id}/image`
    })
  }, [currentIndex, photos, partyKey])

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

  // FR-G14: keep URL in sync with current photo; restore gallery URL on close
  useEffect(() => {
    if (!partyKey) return
    window.history.replaceState(null, '', `/p/${partyKey}/gallery/${photo.id}`)
    return () => {
      window.history.replaceState(null, '', `/p/${partyKey}/gallery`)
    }
  }, [photo.id, partyKey])

  // Copy-link feedback state
  const [copied, setCopied] = useState(false)
  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const isZoomed = transform.scale > 1.05

  function handleContainerPointerUp() {
    showOverlay()
  }

  function handleContainerMouseMove() {
    showOverlay()
  }

  return (
    <div
      ref={containerRef}
      className={styles.overlay}
      onPointerUp={handleContainerPointerUp}
      onMouseMove={handleContainerMouseMove}
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
          transition:   isInteracting ? 'none' : 'transform 0.2s ease-out',
          cursor:       isZoomed ? 'grab' : 'zoom-out',
          touchAction:  'none',
        }}
        onClick={!isZoomed ? onClose : undefined}
      >
        <PhotoImage
          photo={photo}
          src="full"
          className={styles.image}
          partyKey={partyKey}
        />
      </div>

      {/* ── Auto-hiding overlay bar (FR-G06) ── */}
      <div
        className={`${styles.topBar} ${overlayVisible ? styles.topBarVisible : styles.topBarHidden}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Grid / back button — always visible */}
        <button className={styles.gridBtn} onClick={onClose} aria-label="Tilbake til grid">
          ⊞
        </button>

        {/* FR-G14: Copy direct link — always visible */}
        <button
          className={styles.copyLinkBtn}
          onClick={handleCopyLink}
          aria-label="Kopier lenke til bilde"
          title={copied ? 'Kopiert!' : 'Kopier lenke'}
        >
          {copied ? '✓' : '🔗'}
        </button>

        <span className={styles.counter}>{currentIndex + 1} / {photos.length}</span>

        <div className={styles.topBarRight}>
          {/* Flag button — logged-in users only */}
          {user && (
            <FlagButton photo={photo} onFlagged={onFlag} partyKey={partyKey} />
          )}
          {/* 3-dot menu */}
          {user && <ThreeDotMenu partyKey={partyKey} />}
        </div>
      </div>

      {/* Prev / Next arrows (no nav when zoomed) */}
      {!isZoomed && (
        <>
          {currentIndex > 0 && (
            <button
              className={`${styles.navBtn} ${styles.prev}`}
              onClick={() => { reset(); onNavigate(currentIndex - 1) }}
              aria-label="Forrige bilde"
            >‹</button>
          )}
          {currentIndex < photos.length - 1 && (
            <button
              className={`${styles.navBtn} ${styles.next}`}
              onClick={() => { reset(); onNavigate(currentIndex + 1) }}
              aria-label="Neste bilde"
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
