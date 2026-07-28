import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useParty } from '../context/PartyContext.jsx'
import { usePhotos } from '../hooks/usePhotos.js'
import { useAdminBadge } from '../hooks/useAdminBadge.js'
import { FullScreenView } from '../components/gallery/FullScreenView.jsx'
import { GridView }       from '../components/gallery/GridView.jsx'
import { GalleryFilters } from '../components/gallery/GalleryFilters.jsx'
import ThreeDotMenu from '../components/ThreeDotMenu.jsx'
import styles from './GalleryPage.module.css'

// FR-G16: identify uploaders by account when logged in, else by the free-text
// name they entered at upload time (falling back to "Anonym" if left blank).
function uploaderKey(photo) {
  return photo.user_id != null ? `u:${photo.user_id}` : `a:${photo.uploader_name || ''}`
}
function uploaderLabel(photo) {
  if (photo.user_id != null) return photo.uploader_display_name || photo.uploader_name || 'Ukjent bruker'
  return photo.uploader_name?.trim() || 'Anonym'
}

export default function GalleryPage() {
  const { user }              = useAuth()
  const { partyKey, photoId } = useParams()
  const redirect              = useNavigate()
  const { party }             = useParty() || {}
  const [searchParams]        = useSearchParams()

  // FR-G15: redirect logged-in users with no party role to the party front page
  const hasRole = user?.is_super_admin || (user?.party_roles || []).some(r => r.party_key === partyKey)
  useEffect(() => {
    if (user && !hasRole) redirect(`/p/${partyKey}`, { replace: true })
  }, [user, hasRole, partyKey, redirect])

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

  // FR-G16: uploader filter (multi-select)
  const [selectedUploaders, setSelectedUploaders] = useState(new Set())
  // FR-G17: sort mode — capture time, or by uploader (then capture time within each uploader)
  const [sortBy, setSortBy] = useState('time') // 'time' | 'user'
  const [sortDir, setSortDir] = useState('asc')

  const uploaderOptions = useMemo(() => {
    const map = new Map()
    for (const p of photos) {
      const key = uploaderKey(p)
      const existing = map.get(key)
      if (existing) existing.count += 1
      else map.set(key, { key, label: uploaderLabel(p), count: 1 })
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'nb'))
  }, [photos])

  const hasActiveFilter = ownOnly || selectedUploaders.size > 0

  const displayPhotos = useMemo(() => {
    let result = photos
    if (ownOnly && user) result = result.filter((p) => p.user_id === user.id)
    if (selectedUploaders.size > 0) result = result.filter((p) => selectedUploaders.has(uploaderKey(p)))

    if (sortBy === 'user') {
      // Primary: uploader name (direction-toggled). Secondary: capture time, always chronological.
      result = [...result].sort((a, b) => {
        const labelCmp = uploaderLabel(a).localeCompare(uploaderLabel(b), 'nb')
        if (labelCmp !== 0) return sortDir === 'asc' ? labelCmp : -labelCmp
        const at = a.captured_at || a.created_at
        const bt = b.captured_at || b.created_at
        return at < bt ? -1 : at > bt ? 1 : 0
      })
    } else if (sortDir === 'desc') {
      // Server already returns capture-time ascending; reverse for descending.
      result = [...result].reverse()
    }
    return result
  }, [photos, ownOnly, user, selectedUploaders, sortBy, sortDir])

  // FR-A04: pending badge (managers/owners/super admin)
  const { pendingCount } = useAdminBadge(canModerate, partyKey ? `/api/p/${partyKey}/admin/pending-count` : null)

  // Navigation state
  const [currentIndex, setCurrentIndex]     = useState(0)
  const [showFullScreen, setShowFullScreen] = useState(false)

  // Reset index when filter or photo list changes
  useEffect(() => { setCurrentIndex(0) }, [ownOnly, selectedUploaders, sortBy, sortDir])
  useEffect(() => {
    if (displayPhotos.length > 0) {
      setCurrentIndex((i) => Math.min(i, displayPhotos.length - 1))
    }
  }, [displayPhotos.length])

  // FR-G14: auto-open a specific photo when arriving via direct link
  useEffect(() => {
    if (!photoId || photos.length === 0) return
    const idx = photos.findIndex(p => String(p.id) === photoId)
    if (idx !== -1) {
      setCurrentIndex(idx)
      setShowFullScreen(true)
    }
  }, [photoId, photos])

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
          {hasActiveFilter ? 'Ingen bilder matcher filteret.' : isHiddenMode ? 'Ingen skjulte bilder.' : 'Ingen bilder ennå.'}
        </p>
        {!isHiddenMode && !hasActiveFilter && (
          <Link to={`/p/${partyKey}/upload`} className={styles.uploadLink}>Last opp det første! →</Link>
        )}
        {hasActiveFilter && (
          <button className={styles.ownOnlyToggle} onClick={() => { setOwnOnly(false); setSelectedUploaders(new Set()) }}>
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

      {/* Top-right control row: uploader filter/sort, own-photos toggle, 3-dot menu */}
      {user && (
        <div className={styles.topBar}>
          {!isHiddenMode && (
            <GalleryFilters
              uploaders={uploaderOptions}
              selected={selectedUploaders}
              onChangeSelected={setSelectedUploaders}
              sortBy={sortBy}
              onChangeSortBy={setSortBy}
              sortDir={sortDir}
              onChangeSortDir={setSortDir}
            />
          )}

          {/* FR-G09: Own-photos filter (logged-in users, not in hidden mode) */}
          {!isHiddenMode && (
            <button
              className={`${styles.ownOnlyBtn} ${ownOnly ? styles.ownOnlyActive : ''}`}
              onClick={() => setOwnOnly((v) => !v)}
              title={ownOnly ? 'Vis alle bilder' : 'Vis bare mine bilder'}
            >
              {ownOnly ? '👤 Mine' : '👥 Alle'}
            </button>
          )}

          <ThreeDotMenu partyKey={partyKey} />
        </div>
      )}

      {/* FR-A04: Pending-deletions badge for managers/admins (shown inline in ThreeDotMenu, kept as link shortcut) */}
      {canModerate && pendingCount > 0 && (
        <Link to={`/p/${partyKey}/admin`} className={styles.adminBadge} title="Ventende slettingsforespørsler">
          🔔 {pendingCount}
        </Link>
      )}

      {/* ── Grid view — default on all screen sizes (FR-G07) ───
          Always mounted (even under the full-screen overlay) so the page's
          scroll position survives opening/closing the full-screen view. */}
      <GridView
        photos={displayPhotos}
        currentIndex={currentIndex}
        onPhotoClick={handleGridPhotoClick}
        isMobile={false}
        isHiddenMode={isHiddenMode}
        onUnhide={handleUnhide}
        partyKey={partyKey}
      />

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
