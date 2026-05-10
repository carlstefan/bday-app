import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useParty } from '../context/PartyContext.jsx'
import { api } from '../api/client.js'
import ThreeDotMenu from '../components/ThreeDotMenu.jsx'
import styles from './HomePage.module.css'
import partyStyles from './PartyHomePage.module.css'

export default function PartyHomePage() {
  const { user, refetch: refreshUser } = useAuth()
  const { partyKey } = useParams()
  const { party, loading, error } = useParty()

  // FR-G15: first-visit join banner state
  const hasRole = user?.is_super_admin || (user?.party_roles || []).some(r => r.party_key === partyKey)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [joining, setJoining] = useState(false)
  const showBanner = user && !hasRole && !bannerDismissed

  async function handleJoin() {
    setJoining(true)
    try {
      await api.post(`/api/parties/${partyKey}/join`)
      await refreshUser()        // re-fetch /api/auth/me so party_roles updates
      setBannerDismissed(true)
    } catch (err) {
      alert(err.message)
    } finally {
      setJoining(false)
    }
  }

  // Set browser tab title to party name
  useEffect(() => {
    if (party?.name) document.title = party.name
    return () => { document.title = 'Bildefest' }
  }, [party?.name])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={partyStyles.state}>Laster…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={partyStyles.state}>
          <p>{error}</p>
          <Link to="/">← Tilbake til forsiden</Link>
        </div>
      </div>
    )
  }

  const canModerate = user?.is_super_admin || user?.party_roles?.some(
    r => r.party_key === partyKey && ['manager', 'owner'].includes(r.role)
  )

  return (
    <div className={styles.page}>
      {/* FR-G15: First-visit welcome banner */}
      {showBanner && (
        <div className={partyStyles.welcomeBanner}>
          <p>
            Hei, {user.display_name}! Du besøker <strong>{party?.name || partyKey}</strong> for første gang.
            Vil du bli med og få tilgang til galleriet?
          </p>
          <div className={partyStyles.welcomeActions}>
            <button className={partyStyles.joinBtn} onClick={handleJoin} disabled={joining}>
              {joining ? '…' : 'Bli med på festen'}
            </button>
            <button className={partyStyles.dismissBtn} onClick={() => setBannerDismissed(true)}>
              Ikke nå
            </button>
          </div>
        </div>
      )}

      {/* 3-dot menu for logged-in users */}
      {user && (
        <div className={partyStyles.menuCorner}>
          <ThreeDotMenu partyKey={partyKey} />
        </div>
      )}

      {/* Hero section */}
      <div className={styles.hero}>
        {party?.featured_photo_id ? (
          <img
            src={`/api/p/${partyKey}/featured-photo`}
            alt={party.name}
            className={styles.heroImg}
          />
        ) : (
          <div className={partyStyles.heroPlaceholder}>
            <span className={partyStyles.heroPlaceholderText}>
              {canModerate
                ? 'Ingen fremhevet bilde ennå — last opp bilder og velg ett fra admin-panelet.'
                : 'Ingen fremhevet bilde ennå.'}
            </span>
          </div>
        )}
        <div className={styles.heroOverlay} />
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>{party?.name || partyKey}</h1>

        {party?.description && (
          <p className={styles.subtitle}>{party.description}</p>
        )}

        <div className={styles.actions}>
          {party?.submissions_open !== false && (
            <Link to={`/p/${partyKey}/upload`} className={styles.btnPrimary}>
              Last opp bilder
            </Link>
          )}

          {user ? (
            <Link to={`/p/${partyKey}/gallery`} className={styles.btnSecondary}>
              Se galleriet
            </Link>
          ) : (
            <Link
              to={`/login?next=${encodeURIComponent(`/p/${partyKey}/gallery`)}`}
              className={styles.btnSecondary}
            >
              Logg inn for å se galleriet
            </Link>
          )}
        </div>

        {user && !showBanner && (
          <p className={styles.welcome}>
            Hei, {user.display_name}!{' '}
            {canModerate && (
              <Link to={`/p/${partyKey}/admin`}>Admin-panel →</Link>
            )}
            {user.is_super_admin && (
              <>{' '}<Link to="/admin">Super Admin →</Link></>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
