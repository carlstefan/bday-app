import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePhotos } from '../hooks/usePhotos.js'
import { useViewport } from '../hooks/useViewport.js'
import { SushiBar }       from '../components/gallery/SushiBar.jsx'
import { PortraitView }   from '../components/gallery/PortraitView.jsx'
import { FullScreenView } from '../components/gallery/FullScreenView.jsx'
import { GridView }       from '../components/gallery/GridView.jsx'
import styles from './GalleryPage.module.css'

export default function GalleryPage() {
  const { user }                        = useAuth()
  const { photos, loading, error }      = usePhotos()
  const { width, isPortrait }           = useViewport()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [showFullScreen, setShowFullScreen] = useState(false)
  const [showGrid, setShowGrid]         = useState(false)

  // Clamp index when photos list changes
  useEffect(() => {
    if (photos.length > 0) {
      setCurrentIndex((i) => Math.min(i, photos.length - 1))
    }
  }, [photos.length])

  const navigate = useCallback((idx) => {
    setCurrentIndex(Math.max(0, Math.min(photos.length - 1, idx)))
  }, [photos.length])

  // Global keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (showFullScreen) return  // FullScreenView handles its own keys
      if (e.key === 'ArrowLeft')  navigate(currentIndex - 1)
      if (e.key === 'ArrowRight') navigate(currentIndex + 1)
      if (e.key === 'Escape' && showGrid) setShowGrid(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex, showFullScreen, showGrid, navigate])

  // ── Loading / error / empty ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.state}>
        <div className={styles.spinner} aria-label="Loading" />
        <span>Laster bilder…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.state}>
        <p className={styles.errorMsg}>{error}</p>
        <Link to="/" className={styles.homeLink}>← Tilbake til forsiden</Link>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className={styles.state}>
        <p>Ingen bilder ennå.</p>
        <Link to="/upload" className={styles.uploadLink}>Last opp det første! →</Link>
        <Link to="/" className={styles.homeLink}>← Forsiden</Link>
      </div>
    )
  }

  // ── View selection ───────────────────────────────────────────────────────
  // Portrait phone or narrow viewport → PortraitView
  const usePortrait = isPortrait && width < 480

  // Grid toggle only available at 1024px+ and only in SushiBar mode
  const canGrid = width >= 1024 && !usePortrait

  return (
    <div className={styles.gallery}>

      {/* Grid toggle button (1024px+ only) */}
      {canGrid && (
        <button
          className={styles.gridToggle}
          onClick={() => setShowGrid((g) => !g)}
          aria-label={showGrid ? 'Switch to sushi bar view' : 'Switch to grid view'}
          title={showGrid ? 'Sushi-visning' : 'Rutenett'}
        >
          {showGrid ? '▤ Sushi' : '⊞ Grid'}
        </button>
      )}

      {/* ── Portrait phone view ─── */}
      {usePortrait && !showFullScreen && (
        <PortraitView
          photos={photos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onOpenFullScreen={() => setShowFullScreen(true)}
        />
      )}

      {/* ── Sushi bar (default for 480px+) ─── */}
      {!usePortrait && !showGrid && !showFullScreen && (
        <SushiBar
          photos={photos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onOpenFullScreen={() => setShowFullScreen(true)}
        />
      )}

      {/* ── Grid view (1024px+ toggle) ─── */}
      {canGrid && showGrid && !showFullScreen && (
        <GridView
          photos={photos}
          currentIndex={currentIndex}
          onSelect={(idx) => {
            navigate(idx)
            setShowGrid(false)   // click → land in sushi bar at that photo
          }}
        />
      )}

      {/* ── Full-screen overlay (any view) ─── */}
      {showFullScreen && (
        <FullScreenView
          photos={photos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onClose={() => setShowFullScreen(false)}
        />
      )}

      {/* Upload shortcut */}
      <Link to="/upload" className={styles.uploadBtn} aria-label="Upload photos">
        +
      </Link>
    </div>
  )
}
