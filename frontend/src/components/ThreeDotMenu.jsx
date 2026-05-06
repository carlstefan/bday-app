import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import { useAdminBadge } from '../hooks/useAdminBadge.js'
import PreferencesModal from './PreferencesModal.jsx'
import styles from './ThreeDotMenu.module.css'

/**
 * Universal 3-dot menu for all logged-in users.
 * Sections are conditionally rendered by role.
 */
export default function ThreeDotMenu({ partyKey }) {
  const { user, refetch } = useAuth()
  const navigate = useNavigate()

  const [open, setOpen]             = useState(false)
  const [showPrefs, setShowPrefs]   = useState(false)
  const menuRef = useRef(null)

  const canModerate = user?.is_super_admin || (user?.party_roles || []).some(
    r => r.party_key === partyKey && ['manager', 'owner'].includes(r.role)
  )
  const isOwner = user?.is_super_admin || (user?.party_roles || []).some(
    r => r.party_key === partyKey && r.role === 'owner'
  )
  const multiParty = user?.is_super_admin || (user?.party_roles?.length ?? 0) > 1

  const { pendingCount } = useAdminBadge(
    canModerate && Boolean(partyKey),
    partyKey ? `/api/p/${partyKey}/admin/pending-count` : null
  )

  // Close menu on outside click
  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  if (!user) return null

  async function handleLogout() {
    try { await api.post('/api/auth/logout') } catch {}
    await refetch()
    navigate('/')
    setOpen(false)
  }

  return (
    <div className={styles.wrapper} ref={menuRef}>
      <button
        className={styles.trigger}
        onClick={() => setOpen(v => !v)}
        aria-label="Meny"
        aria-expanded={open}
      >
        ⋮
        {pendingCount > 0 && (
          <span className={styles.badge} aria-label={`${pendingCount} ventende`}>{pendingCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.menu} role="menu">

          {/* ── Preferences (all logged-in users) ── */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Innstillinger</div>
            <button className={styles.item} onClick={() => { setShowPrefs(true); setOpen(false) }}>
              Endre visningsnavn
            </button>
            <button className={styles.item} onClick={() => { setShowPrefs(true); setOpen(false) }}>
              Slett konto
            </button>
          </div>

          {/* ── Switch party (multi-party users + super admin) ── */}
          {multiParty && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Bytt fest</div>
              {user.is_super_admin ? (
                // Super admin: link to super admin panel to see all parties
                <button className={styles.item} onClick={() => { navigate('/admin'); setOpen(false) }}>
                  Alle fester (Super Admin) →
                </button>
              ) : (
                (user.party_roles || []).map(r => (
                  <button
                    key={r.party_key}
                    className={`${styles.item} ${r.party_key === partyKey ? styles.itemActive : ''}`}
                    onClick={() => { navigate(`/p/${r.party_key}`); setOpen(false) }}
                  >
                    {r.party_name}
                  </button>
                ))
              )}
            </div>
          )}

          {/* ── Moderation (manager / owner / super admin) ── */}
          {canModerate && partyKey && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Moderering</div>
              <button className={styles.item} onClick={() => { navigate(`/p/${partyKey}/admin`); setOpen(false) }}>
                Moderate bilder
                {pendingCount > 0 && <span className={styles.inlineBadge}>{pendingCount}</span>}
              </button>
              <button className={styles.item} onClick={() => { navigate(`/p/${partyKey}/gallery?mode=hidden`); setOpen(false) }}>
                Skjulte bilder
              </button>
              <a
                className={styles.item}
                href={`/api/p/${partyKey}/admin/download`}
                download
                onClick={() => setOpen(false)}
              >
                Last ned arkiv (zip)
              </a>
            </div>
          )}

          {/* ── Party settings (owner / super admin) ── */}
          {isOwner && partyKey && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Festinnstillinger</div>
              <button className={styles.item} onClick={() => { navigate(`/p/${partyKey}/admin`); setOpen(false) }}>
                Innstillinger og roller →
              </button>
            </div>
          )}

          {/* ── Super Admin panel ── */}
          {user.is_super_admin && (
            <div className={styles.section}>
              <button className={`${styles.item} ${styles.itemSuper}`} onClick={() => { navigate('/admin'); setOpen(false) }}>
                Super Admin-panel →
              </button>
            </div>
          )}

          {/* ── Logout ── */}
          <div className={styles.section}>
            <button className={`${styles.item} ${styles.itemLogout}`} onClick={handleLogout}>
              Logg ut
            </button>
          </div>
        </div>
      )}

      {showPrefs && (
        <PreferencesModal onClose={() => setShowPrefs(false)} />
      )}
    </div>
  )
}
