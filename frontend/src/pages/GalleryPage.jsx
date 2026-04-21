import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { usePhotos } from '../hooks/usePhotos.js'
import { useAdminBadge } from '../hooks/useAdminBadge.js'
import { useViewport } from '../hooks/useViewport.js'
import { SushiBar }       from '../components/gallery/SushiBar.jsx'
import { PortraitView }   from '../components/gallery/PortraitView.jsx'
import { FullScreenView } from '../components/gallery/FullScreenView.jsx'
import { GridView }       from '../components/gallery/GridView.jsx'
import styles from './GalleryPage.module.css'

export default function GalleryPage() {
  const { user }                        = useAuth()
  const [searchParams]                  = useSearchParams()
  const { width, isPortrait }           = useViewport()

  // FR-A05: detect hidden gallery mode (admins only)
  const isHiddenMode = user?.is_admin && searchParams.get('mode') === 'hidden'

  // Choose fetch URL based on mode
  const photosUrl = isHiddenMode
    ? '/api/admin/hidden-photos'
    : '/api/photos?limit=500'

  const { photos, loading, error, setPhotos } = usePhotos(photosUrl)

  // FR-G09: own-photos filter
  const [ownOnly, setOwnOnly] = useState(false)

  const displayPhotos = useMemo(() => {
    if (!ownOnly || !user) return photos
    return photos.filter((p) => p.user_id === user.id)
  }, [photos, ownOnly, user])

  // FR-A04: admin pending badge
  const { pendingCount } = useAdminBadge(Boolean(user?.is_admin))

  const [currentIndex, setCurrentIndex] = useState(0)
  const [showFullScreen, setShowFullScreen] = useState(false)
  const [showGrid, setShowGrid]         = useState(false)

  // Reset index when filter changes or photo list changes
  useEffect(() => {
    setCurrentIndex(0)
  }, [ownOnly])

  useEffect(() => {
    if (displayPhotos.length > 0) {
      setCurrentIndex((i) => Math.min(i, displayPhotos.length - 1))
    }
  }, [displayPhotos.length])

  function handlePhotoUpdate(photoId, patch) {
    setPhotos((prev) => prev.map((p) => p.id === photoId ? { ...p, ...patch } : p))
  }

  // Own-photo flag: remove from gallery (photo was auto-hidden)
  function handlePhotoFlagged(photoId) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    setCurrentIndex((i) => Math.max(0, Math.min(i, displayPhotos.length - 2)))
  }

  // FR-A05: Unhide a photo from the hidden gallery
  async function handleUnhide(photoId) {
    try {
      await api.patch(`/api/admin/photos/${photoId}/unhide`)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } catch (err) {
      alert(err.message)
    }
  }

  const navigate = useCallback((idx) => {
    setCurrentIndex(Math.max(0, Math.min(displayPhotos.length - 1, idx)))
  }, [displayPhotos.length])

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

  if (displayPhotos.length === 0) {
    return (
      <div className={styles.state}>
        <p>{ownOnly ? 'Du har ingen bilder ennå.' : isHiddenMode ? 'Ingen skjulte bilder.' : 'Ingen bilder ennå.'}</p>
        {!isHiddenMode && !ownOnly && (
          <Link to="/upload" className={styles.uploadLink}>Last opp det første! →</Link>
        )}
        {ownOnly && (
          <button className={styles.ownOnlyToggle} onClick={() => setOwnOnly(false)}>
            Vis alle bilder
          </button>
        )}
        {isHiddenMode && (
          <Link to="/gallery" className={styles.homeLink}>← Tilbake til galleriet</Link>
        )}
        {!isHiddenMode && <Link to="/" className={styles.homeLink}>← Forsiden</Link>}
      </div>
    )
  }

  // ── View selection ───────────────────────────────────────────────────────
  const usePortrait = isPortrait && width < 480
  const canGrid = width >= 1024 && !usePortrait
  const currentPhoto = displayPhotos[currentIndex]

  return (
    <div className={styles.gallery}>

      {/* FR-A05: Hidden gallery banner */}
      {isHiddenMode && (
        <div className={styles.hiddenBanner}>
          <Link to="/gallery" className={styles.hiddenBannerBack}>← Galleriet</Link>
          <span className={styles.hiddenBannerLabel}>Skjulte bilder ({displayPhotos.length})</span>
          {currentPhoto && (
            <button
              className={styles.unhideBtn}
              onClick={() => handleUnhide(currentPhoto.id)}
            >
              Vis frem igjen
            </button>
          )}
        </div>
      )}

      {/* FR-A04: Admin pending-deletions badge */}
      {user?.is_admin && pendingCount > 0 && (
        <Link to="/admin" className={styles.adminBadge} title="Ventende slettingsforespørsler">
          🔔 {pendingCount}
        </Link>
      )}

      {/* Grid toggle button (1024px+ only, not in hidden mode) */}
      {canGrid && !isHiddenMode && (
        <button
          className={styles.gridToggle}
          onClick={() => setShowGrid((g) => !g)}
          aria-label={showGrid ? 'Switch to sushi bar view' : 'Switch to grid view'}
          title={showGrid ? 'Sushi-visning' : 'Rutenett'}
        >
          {showGrid ? '▤ Sushi' : '⊞ Grid'}
        </button>
      )}

      {/* FR-G09: Own-photos filter toggle (only when logged in, not in hidden mode) */}
      {user && !isHiddenMode && (
        <button
          className={`${styles.ownOnlyBtn} ${ownOnly ? styles.ownOnlyActive : ''}`}
          onClick={() => setOwnOnly((v) => !v)}
          title={ownOnly ? 'Vis alle bilder' : 'Vis bare mine bilder'}
        >
          {ownOnly ? '👤 Mine' : '👥 Alle'}
        </button>
      )}

      {/* ── Portrait phone view ─── */}
      {usePortrait && !showFullScreen && (
        <PortraitView
          photos={displayPhotos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onOpenFullScreen={() => setShowFullScreen(true)}
          onPhotoUpdate={handlePhotoUpdate}
          onPhotoFlagged={handlePhotoFlagged}
        />
      )}

      {/* ── Sushi bar (default for 480px+) ─── */}
      {!usePortrait && !showGrid && !showFullScreen && (
        <SushiBar
          photos={displayPhotos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onOpenFullScreen={() => setShowFullScreen(true)}
          onPhotoUpdate={handlePhotoUpdate}
          onPhotoFlagged={handlePhotoFlagged}
        />
      )}

      {/* ── Grid view (1024px+ toggle) ─── */}
      {canGrid && showGrid && !showFullScreen && (
        <GridView
          photos={displayPhotos}
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
          photos={displayPhotos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onClose={() => setShowFullScreen(false)}
        />
      )}

      {/* Upload shortcut — not shown in hidden gallery mode */}
      {!isHiddenMode && (
        <Link to="/upload" className={styles.uploadBtn} aria-label="Upload photos">
          +
        </Link>
      )}
    </div>
  )
}
