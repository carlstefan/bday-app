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
  const { user }                        = useAuth()
  const [searchParams]                  = useSearchParams()
  const { width }                       = useViewport()

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

  const isMobile = width < 480

  const [currentIndex, setCurrentIndex]     = useState(0)
  const [showFullScreen, setShowFullScreen] = useState(false)
  // Mobile only: 'single' | 'grid'
  const [mobileView, setMobileView]         = useState('single')

  // Reset index when filter or photo list changes
  useEffect(() => { setCurrentIndex(0) }, [ownOnly])

  useEffect(() => {
    if (displayPhotos.length > 0) {
      setCurrentIndex((i) => Math.min(i, displayPhotos.length - 1))
    }
  }, [displayPhotos.length])

  function handlePhotoUpdate(photoId, patch) {
    setPhotos((prev) => prev.map((p) => p.id === photoId ? { ...p, ...patch } : p))
  }

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
      if (showFullScreen) return
      if (e.key === 'ArrowLeft')  navigate(currentIndex - 1)
      if (e.key === 'ArrowRight') navigate(currentIndex + 1)
      if (e.key === 'Escape' && isMobile && mobileView === 'grid') setMobileView('single')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex, showFullScreen, isMobile, mobileView, navigate])

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

  // ── Which views to render ────────────────────────────────────────────────
  // Mobile (<480px): PortraitView or GridView depending on mobileView state
  // Desktop (≥480px): GridView always; click thumbnail → FullScreenView
  const showPortrait = isMobile && mobileView === 'single' && !showFullScreen
  const showGrid     = (!isMobile || mobileView === 'grid') && !showFullScreen

  // Grid thumbnail click:
  // - mobile  → navigate + return to portrait view
  // - desktop → navigate + open full-screen
  function handleGridPhotoClick(idx) {
    navigate(idx)
    if (isMobile) {
      setMobileView('single')
    } else {
      setShowFullScreen(true)
    }
  }

  return (
    <div className={styles.gallery}>

      {/* FR-A05: Hidden gallery banner */}
      {isHiddenMode && (
        <div className={styles.hiddenBanner}>
          <Link to="/gallery" className={styles.hiddenBannerBack}>← Galleriet</Link>
          <span className={styles.hiddenBannerLabel}>Skjulte bilder ({displayPhotos.length})</span>
        </div>
      )}

      {/* FR-A04: Admin pending-deletions badge */}
      {user?.is_admin && pendingCount > 0 && (
        <Link to="/admin" className={styles.adminBadge} title="Ventende slettingsforespørsler">
          🔔 {pendingCount}
        </Link>
      )}

      {/* FR-G09: Own-photos filter toggle (logged-in users, not in hidden mode) */}
      {user && !isHiddenMode && (
        <button
          className={`${styles.ownOnlyBtn} ${ownOnly ? styles.ownOnlyActive : ''}`}
          onClick={() => setOwnOnly((v) => !v)}
          title={ownOnly ? 'Vis alle bilder' : 'Vis bare mine bilder'}
        >
          {ownOnly ? '👤 Mine' : '👥 Alle'}
        </button>
      )}

      {/* ── Portrait / single-photo view (mobile only) ─── */}
      {showPortrait && (
        <PortraitView
          photos={displayPhotos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onShowGrid={() => setMobileView('grid')}
          onOpenFullScreen={() => setShowFullScreen(true)}
          onPhotoUpdate={handlePhotoUpdate}
          onPhotoFlagged={handlePhotoFlagged}
        />
      )}

      {/* ── Grid view (default desktop; mobile when mobileView==='grid') ─── */}
      {showGrid && (
        <GridView
          photos={displayPhotos}
          currentIndex={currentIndex}
          onPhotoClick={handleGridPhotoClick}
          isMobile={isMobile}
          isHiddenMode={isHiddenMode}
          onUnhide={handleUnhide}
        />
      )}

      {/* ── Full-screen overlay ─── */}
      {showFullScreen && (
        <FullScreenView
          photos={displayPhotos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onClose={() => setShowFullScreen(false)}
        />
      )}

      {/* Upload FAB */}
      <Link to="/upload" className={styles.uploadBtn} aria-label="Last opp bilder">
        +
      </Link>
    </div>
  )
}
