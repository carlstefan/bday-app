import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useParty } from '../context/PartyContext.jsx'
import { usePhotos } from '../hooks/usePhotos.js'
import { useAdminBadge } from '../hooks/useAdminBadge.js'
import { FullScreenView } from '../components/gallery/FullScreenView.jsx'
import { GridView }       from '../components/gallery/GridView.jsx'
import ThreeDotMenu from '../components/ThreeDotMenu.jsx'
import styles from './GalleryPage.module.css'

export default function GalleryPage() {
  const { user }           = useAuth()
  const { partyKey }       = useParams()
  const { party }          = useParty() || {}
  const [searchParams]     = useSearchParams()

  // FR-A05: detect hidden gallery mode (managers/admins only)
  const canModerate = user?.is_super_admin || (user?.party_roles || []).some(
    r => r.party_key === partyKey && ['manager', 'owner'].includes(r.role)
  )
  const isHiddenMode = canModerate && searchParams.get('mode') === 'hidden'

  const photosUrl = isHiddenMode
    ? `/api/p/${partyKey}/admin/hidden-photos`
    : `/api/p/${partyKey}/photos?limit=500`

  const { photos, loading, error, setPhotos } = usePhotos(photosUrl)

  // FR-G09: own-photos filter
  const [ownOnly, setOwnOnly] = useState(false)

  const displayPhotos = useMemo(() => {
    if (!ownOnly || !user) return photos
    return photos.filter((p) => p.user_id === user.id)
  }, [photos, ownOnly, user])

  // FR-A04: pending badge (managers/owners/super admin)
  const { pendingCount } = useAdminBadge(canModerate, partyKey ? `/api/p/${partyKey}/admin/pending-count` : null)

  // Navigation state
  const [currentIndex, setCurrentIndex]     = useState(0)
  const [showFullScreen, setShowFullScreen] = useState(false)

  // Reset index when filter or photo list changes
  useEffect(() => { setCurrentIndex(0) }, [ownOnly])
  useEffect(() => {
    if (displayPhotos.length > 0) {
      setCurrentIndex((i) => Math.min(i, displayPhotos.length - 1))
    }
  }, [displayPhotos.length])

  const navigate = useCallback((idx) => {
    setCurrentIndex(Math.max(0, Math.min(displayPhotos.length - 1, idx)))
  }, [displayPhotos.length])

  function openFullScreen(idx) {
    navigate(idx)
    setShowFullScreen(true)
  }

  // FR-G07: tapping any thumbnail opens full-screen on all screen sizes
  function handleGridPhotoClick(idx) {
    openFullScreen(idx)
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
      await api.patch(`/api/p/${partyKey}/admin/photos/${photoId}/unhide`)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } catch (err) {
      alert(err.message)
    }
  }

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
          <Link to={`/p/${partyKey}/upload`} className={styles.uploadLink}>Last opp det første! →</Link>
        )}
        {ownOnly && (
          <button className={styles.ownOnlyToggle} onClick={() => setOwnOnly(false)}>
            Vis alle bilder
          </button>
        )}
        {isHiddenMode && (
          <Link to={`/p/${partyKey}/gallery`} className={styles.homeLink}>← Tilbake til galleriet</Link>
        )}
        {!isHiddenMode && <Link to={`/p/${partyKey}`} className={styles.homeLink}>← Forsiden</Link>}
      </div>
    )
  }

  return (
    <div className={styles.gallery}>

      {/* FR-A05: Hidden gallery banner */}
      {isHiddenMode && (
        <div className={styles.hiddenBanner}>
          <Link to={`/p/${partyKey}/gallery`} className={styles.hiddenBannerBack}>← Galleriet</Link>
          <span className={styles.hiddenBannerLabel}>🙈 Skjulte bilder ({displayPhotos.length})</span>
        </div>
      )}

      {/* 3-dot menu for logged-in users */}
      {user && (
        <div className={styles.menuCorner}>
          <ThreeDotMenu partyKey={partyKey} />
        </div>
      )}

      {/* FR-A04: Pending-deletions badge for managers/admins (shown inline in ThreeDotMenu, kept as link shortcut) */}
      {canModerate && pendingCount > 0 && (
        <Link to={`/p/${partyKey}/admin`} className={styles.adminBadge} title="Ventende slettingsforespørsler">
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

      {/* ── Grid view — default on all screen sizes (FR-G07) ─── */}
      {!showFullScreen && (
        <GridView
          photos={displayPhotos}
          currentIndex={currentIndex}
          onPhotoClick={handleGridPhotoClick}
          isMobile={false}
          isHiddenMode={isHiddenMode}
          onUnhide={handleUnhide}
          partyKey={partyKey}
        />
      )}

      {/* ── Full-screen overlay (FR-G06) ─── */}
      {showFullScreen && (
        <FullScreenView
          photos={displayPhotos}
          currentIndex={currentIndex}
          onNavigate={navigate}
          onClose={() => setShowFullScreen(false)}
          user={user}
          onFlag={handlePhotoFlagged}
        />
      )}

      {/* Upload shortcut FAB — not shown in hidden gallery mode */}
      {!isHiddenMode && (
        <Link to={`/p/${partyKey}/upload`} className={styles.uploadBtn} aria-label="Last opp bilder">
          +
        </Link>
      )}
    </div>
  )
}
