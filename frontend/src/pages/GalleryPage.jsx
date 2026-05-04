import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { usePhotos } from '../hooks/usePhotos.js'
import { useAdminBadge } from '../hooks/useAdminBadge.js'
import { useViewport } from '../hooks/useViewport.js'
import { PortraitView }   from '../components/gallery/PortraitView.jsx'
import { FullScreenView } from '../components/gallery/FullScreenView.jsx'
import { GridView }       from '../components/gallery/GridView.jsx'
import styles from './GalleryPage.module.css'

export default function GalleryPage() {
  const { user }           = useAuth()
  const [searchParams]     = useSearchParams()
  const { width }          = useViewport()

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

  // Navigation state
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [showFullScreen, setShowFullScreen] = useState(false)

  // Mobile (<480px): toggle between 'single' photo view and grid
  // Desktop (>=480px): always grid
  const isMobile = width < 480
  const [mobileView, setMobileView] = useState('single') // 'single' | 'grid'

  // Reset index & mobile view when filter or photo list changes
  useEffect(() => { setCurrentIndex(0) }, [ownOnly])
  useEffect(() => {
    if (displayPhotos.length > 0) {
      setCurrentIndex((i) => Math.min(i, displayPhotos.length - 1))
    }
  }, [displayPhotos.length])

  // When resizing past the mobile breakpoint, full-screen still works fine;
  // mobileView state is simply ignored on desktop.

  const navigate = useCallback((idx) => {
    setCurrentIndex(Math.max(0, Math.min(displayPhotos.length - 1, idx)))
  }, [displayPhotos.length])

  function openFullScreen(idx) {
    navigate(idx)
    setShowFullScreen(true)
  }

  // GridView thumbnail click:
  // – mobile: navigate to that photo in single-photo view
  // – desktop: open full-screen directly (FR-G07)
  function handleGridPhotoClick(idx) {
    navigate(idx)
    if (isMobile) {
      setMobileView('single')
    } else {
      setShowFullScreen(true)
    }
  }

  function handlePhotoUpdate(photoId, patch) {
    setPhotos((prev) => prev.map((p) => p.id === photoId ? { ...p, ...patch } : p))
  }

  // Own-photo flag: remove from gallery (photo was auto-hidden)
  function handlePhotoFlagged(photoId) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    setCurrentIndex((i) => Math.max(0, i - 1))
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

  // Global keyboard navigation (portrait single-photo view)
  useEffect(() => {
    function onKey(e) {
      if (showFullScreen) return  // FullScreenView handles its own keys
      if (isMobile && mobileView === 'single') {
        if (e.key === 'ArrowLeft')  navigate(currentIndex - 1)
        if (e.key === 'ArrowRight') navigate(currentIndex + 1)
      }
      if (e.key === 'Escape' && isMobile && mobileView === 'grid') setMobileView('single')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex, showFullScreen, mobileView, isMobile, navigate])

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
        <p className={styles.emptyMsg}>
          {ownOnly ? 'Du har ingen bilder ennå.' : isHiddenMode ? 'Ingen skjulte bilder.' : 'Ingen bilder ennå.'}
        </p>
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

  // ── Determine which view to render ───────────────────────────────────────
  // Desktop (>=480px): always grid view; tap → full-screen
  // Mobile (<480px): single-photo view by default; grid icon → grid view; tap → full-screen
  const showPortrait = isMobile && mobileView === 'single'
  const showGrid     = !isMobile || mobileView === 'grid'

  return (
    <div className={styles.gallery}>

      {/* FR-A05: Hidden gallery banner */}
      {isHiddenMode && (
        <div className={styles.hiddenBanner}>
          <Link to="/gallery" className={styles.hiddenBannerBack}>← Galleriet</Link>
          <span className={styles.hiddenBannerLabel}>🙈 Skjulte bilder ({displayPhotos.length})</span>
        </div>
      )}

      {/* FR-A04: Admin pending-deletions badge */}
      {user?.is_admin && pendingCount > 0 && (
        <Link to="/admin" className={styles.adminBadge} title="Ventende slettingsforespørsler">
          🔔 {pendingCount}
        </Link>
      )}

      {/* FR-G09: Own-photos filter (logged-in users, not in hidden mode) */}
      {user && !isHiddenMode && (
        <button
          className={`${styles.ownOnlyBtn} ${ownOnly ? styles.ownOnlyActive : ''}`}
          onClick={() => setOwnOnly((v) => !v)}
          title={ownOnly ? 'Vis alle bilder' : 'Vis bare mine bilder'}
        >
          {ownOnly ? '👤 Mine' : '👥 Alle'}
        </button>
      )}

      {/* ── Portrait phone: single-photo view (FR-G04) ─── */}
      {showPortrait && !showFullScreen && (
        <PortraitView
          photos={displayPhotos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onOpenFullScreen={() => openFullScreen(currentIndex)}
          onShowGrid={() => setMobileView('grid')}
          onPhotoUpdate={handlePhotoUpdate}
          onPhotoFlagged={handlePhotoFlagged}
        />
      )}

      {/* ── Grid view (default on desktop, toggle on mobile) (FR-G07) ─── */}
      {showGrid && !showFullScreen && (
        <GridView
          photos={displayPhotos}
          currentIndex={currentIndex}
          onPhotoClick={handleGridPhotoClick}
          isMobile={isMobile}
          isHiddenMode={isHiddenMode}
          onUnhide={handleUnhide}
        />
      )}

      {/* ── Full-screen overlay (FR-G06) ─── */}
      {showFullScreen && (
        <FullScreenView
          photos={displayPhotos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onClose={() => setShowFullScreen(false)}
        />
      )}

      {/* Upload shortcut FAB — not shown in hidden gallery mode */}
      {!isHiddenMode && (
        <Link to="/upload" className={styles.uploadBtn} aria-label="Last opp bilder">
          +
        </Link>
      )}
    </div>
  )
}
