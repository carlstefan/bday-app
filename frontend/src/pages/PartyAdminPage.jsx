import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useParty } from '../context/PartyContext.jsx'
import { api } from '../api/client.js'
import styles from './PartyAdminPage.module.css'

export default function PartyAdminPage() {
  const { user }    = useAuth()
  const { partyKey } = useParams()
  const { party, setParty } = useParty()

  const isOwner = user?.is_super_admin || (user?.party_roles || []).some(
    r => r.party_key === partyKey && r.role === 'owner'
  )
  const canModerate = user?.is_super_admin || (user?.party_roles || []).some(
    r => r.party_key === partyKey && ['manager', 'owner'].includes(r.role)
  )

  const [tab, setTab] = useState(canModerate && !isOwner ? 'moderation' : 'settings')

  // ── Party settings ──────────────────────────────────────────────────────
  const [name, setName]           = useState(party?.name || '')
  const [description, setDesc]    = useState(party?.description || '')
  const [submissionsOpen, setSubs] = useState(party?.submissions_open !== 0)
  const [anonUploads, setAnon]    = useState(party?.anonymous_uploads_enabled !== 0)
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState('')
  const [confirmCloseSubs, setConfirmCloseSubs] = useState(false)

  useEffect(() => {
    if (party) {
      setName(party.name)
      setDesc(party.description)
      setSubs(party.submissions_open !== 0)
      setAnon(party.anonymous_uploads_enabled !== 0)
    }
  }, [party])

  async function saveSettings() {
    setSaving(true)
    setSaveMsg('')
    try {
      const data = await api.patch(`/api/parties/${partyKey}`, {
        json: { name, description, submissions_open: submissionsOpen, anonymous_uploads_enabled: anonUploads },
      })
      setParty(data.party)
      setSaveMsg('Lagret!')
    } catch (err) {
      setSaveMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleToggleSubmissions(val) {
    if (!val && !confirmCloseSubs) {
      setConfirmCloseSubs(true)
      return
    }
    setConfirmCloseSubs(false)
    setSubs(val)
  }

  // ── Users & roles ───────────────────────────────────────────────────────
  const [members, setMembers]     = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [roleMsg, setRoleMsg]     = useState('')

  async function loadMembers() {
    setMembersLoading(true)
    try {
      const data = await api.get(`/api/parties/${partyKey}/users`)
      setMembers(data.members || [])
    } catch {}
    setMembersLoading(false)
  }

  useEffect(() => {
    if (tab === 'users' && isOwner) loadMembers()
  }, [tab])

  async function revokeRole(userId) {
    try {
      await api.delete(`/api/parties/${partyKey}/roles/${userId}`)
      setRoleMsg('Rolle fjernet.')
      loadMembers()
    } catch (err) { setRoleMsg(err.message) }
  }

  async function promoteToManager(userId) {
    try {
      await api.post(`/api/parties/${partyKey}/roles`, { json: { user_id: userId, role: 'manager' } })
      setRoleMsg('Rolle tildelt.')
      loadMembers()
    } catch (err) { setRoleMsg(err.message) }
  }

  async function banUser(userId) {
    const reason = window.prompt('Grunn for utestengelse (valgfritt):')
    if (reason === null) return
    try {
      await api.post(`/api/parties/${partyKey}/bans`, { json: { user_id: userId, reason } })
      setRoleMsg('Bruker utestengt.')
      loadMembers()
    } catch (err) { setRoleMsg(err.message) }
  }

  // ── Moderation (deletion requests) ─────────────────────────────────────
  const [requests, setRequests]   = useState([])
  const [reqLoading, setReqLoading] = useState(false)
  const [reqMsg, setReqMsg]       = useState('')

  async function loadRequests() {
    setReqLoading(true)
    try {
      const data = await api.get(`/api/p/${partyKey}/admin/deletion-requests`)
      setRequests(data.requests || [])
    } catch {}
    setReqLoading(false)
  }

  useEffect(() => {
    if (tab === 'moderation') loadRequests()
  }, [tab])

  async function moderateRequest(id, action) {
    try {
      await api.patch(`/api/p/${partyKey}/admin/deletion-requests/${id}/${action}`)
      setReqMsg('Utført.')
      loadRequests()
    } catch (err) { setReqMsg(err.message) }
  }

  // ── Featured photo picker ─────────────────────────────────────────────
  const [photos, setPhotos]       = useState([])
  const [photoLoading, setPhotoLoading] = useState(false)
  const [featuredMsg, setFeaturedMsg] = useState('')

  async function loadPhotos() {
    setPhotoLoading(true)
    try {
      const data = await api.get(`/api/p/${partyKey}/photos?limit=100`)
      setPhotos(data.photos || [])
    } catch {}
    setPhotoLoading(false)
  }

  useEffect(() => {
    if (tab === 'featured') loadPhotos()
  }, [tab])

  async function setFeatured(photoId) {
    try {
      await api.patch(`/api/parties/${partyKey}/featured-photo`, { json: { photo_id: photoId } })
      setFeaturedMsg('Fremhevet bilde oppdatert!')
      if (setParty) setParty(p => ({ ...p, featured_photo_id: photoId }))
    } catch (err) { setFeaturedMsg(err.message) }
  }

  if (!party) return <div className={styles.state}>Laster…</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to={`/p/${partyKey}`} className={styles.backLink}>← {party.name}</Link>
        <h1 className={styles.title}>Admin: {party.name}</h1>
      </div>

      <div className={styles.tabs}>
        {isOwner && <button className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`} onClick={() => setTab('settings')}>Innstillinger</button>}
        {isOwner && <button className={`${styles.tab} ${tab === 'users' ? styles.tabActive : ''}`} onClick={() => setTab('users')}>Brukere & roller</button>}
        {isOwner && <button className={`${styles.tab} ${tab === 'featured' ? styles.tabActive : ''}`} onClick={() => setTab('featured')}>Fremhevet bilde</button>}
        {canModerate && <button className={`${styles.tab} ${tab === 'moderation' ? styles.tabActive : ''}`} onClick={() => setTab('moderation')}>Moderering</button>}
      </div>

      {/* ── Settings ── */}
      {tab === 'settings' && isOwner && (
        <div className={styles.section}>
          <label className={styles.fieldLabel}>
            Festnavn
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} maxLength={120} />
          </label>
          <label className={styles.fieldLabel}>
            Beskrivelse
            <textarea className={styles.textarea} value={description} onChange={e => setDesc(e.target.value)} maxLength={500} rows={4} />
          </label>

          <div className={styles.toggleRow}>
            <span>Opplastinger åpne</span>
            <div className={styles.toggleGroup}>
              {submissionsOpen ? (
                <button className={styles.toggleOff} onClick={() => handleToggleSubmissions(false)}>
                  Steng opplastinger
                </button>
              ) : (
                <button className={styles.toggleOn} onClick={() => setSubs(true)}>
                  Åpne opplastinger
                </button>
              )}
            </div>
          </div>

          {confirmCloseSubs && (
            <div className={styles.confirmBox}>
              <p>Er du sikker på at du vil stenge opplastinger for denne festen?</p>
              <div className={styles.confirmRow}>
                <button className={styles.btnDanger} onClick={() => { setSubs(false); setConfirmCloseSubs(false) }}>Ja, steng</button>
                <button className={styles.btnSecondary} onClick={() => setConfirmCloseSubs(false)}>Avbryt</button>
              </div>
            </div>
          )}

          <div className={`${styles.toggleRow} ${!submissionsOpen ? styles.disabled : ''}`}>
            <span>Anonyme opplastinger</span>
            <button
              className={anonUploads ? styles.toggleOff : styles.toggleOn}
              onClick={() => submissionsOpen && setAnon(v => !v)}
              disabled={!submissionsOpen}
            >
              {anonUploads ? 'Deaktiver' : 'Aktiver'}
            </button>
          </div>

          {saveMsg && <p className={styles.msg}>{saveMsg}</p>}
          <button className={styles.btnPrimary} onClick={saveSettings} disabled={saving}>
            {saving ? 'Lagrer…' : 'Lagre innstillinger'}
          </button>
        </div>
      )}

      {/* ── Users & roles ── */}
      {tab === 'users' && isOwner && (
        <div className={styles.section}>
          {membersLoading ? <p>Laster…</p> : (
            <>
              {roleMsg && <p className={styles.msg}>{roleMsg}</p>}
              {members.length === 0 ? <p className={styles.empty}>Ingen registrerte brukere ennå.</p> : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Navn</th>
                      <th>Rolle</th>
                      <th>Handlinger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id}>
                        <td>{m.display_name}</td>
                        <td className={styles.roleCell}>{m.role}</td>
                        <td className={styles.actions}>
                          {m.role !== 'owner' && (
                            <button className={styles.actionBtn} onClick={() => promoteToManager(m.id)}>
                              {m.role === 'manager' ? 'Nedgrader' : 'Gjør til manager'}
                            </button>
                          )}
                          <button className={styles.actionBtnDanger} onClick={() => banUser(m.id)}>
                            Utesteng
                          </button>
                          {m.role !== 'owner' && (
                            <button className={styles.actionBtn} onClick={() => revokeRole(m.id)}>
                              Fjern rolle
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Featured photo picker ── */}
      {tab === 'featured' && isOwner && (
        <div className={styles.section}>
          <p className={styles.desc}>Velg et bilde som vises som hero-bilde på festens forside.</p>
          {featuredMsg && <p className={styles.msg}>{featuredMsg}</p>}
          {photoLoading ? <p>Laster bilder…</p> : (
            <div className={styles.photoGrid}>
              {photos.map(p => (
                <button
                  key={p.id}
                  className={`${styles.photoThumb} ${party.featured_photo_id === p.id ? styles.photoThumbActive : ''}`}
                  onClick={() => setFeatured(p.id)}
                  title="Velg som fremhevet bilde"
                >
                  <img
                    src={`/api/p/${partyKey}/photos/${p.id}/thumbnail`}
                    alt={p.uploader_name || 'bilde'}
                    className={styles.thumbImg}
                  />
                </button>
              ))}
              {photos.length === 0 && <p className={styles.empty}>Ingen bilder lastet opp ennå.</p>}
            </div>
          )}
        </div>
      )}

      {/* ── Moderation ── */}
      {tab === 'moderation' && canModerate && (
        <div className={styles.section}>
          {reqMsg && <p className={styles.msg}>{reqMsg}</p>}
          <div className={styles.moderationActions}>
            <a href={`/api/p/${partyKey}/admin/download`} download className={styles.btnSecondary}>
              Last ned arkiv (zip)
            </a>
            <Link to={`/p/${partyKey}/gallery?mode=hidden`} className={styles.btnSecondary}>
              Skjulte bilder
            </Link>
          </div>

          <h3 className={styles.subTitle}>Ventende slettingsforespørsler</h3>
          {reqLoading ? <p>Laster…</p> : requests.length === 0 ? (
            <p className={styles.empty}>Ingen ventende forespørsler.</p>
          ) : (
            <div className={styles.requestList}>
              {requests.map(r => (
                <div key={r.id} className={styles.requestCard}>
                  <img
                    src={`/api/p/${partyKey}/photos/${r.photo_id}/thumbnail`}
                    alt=""
                    className={styles.requestThumb}
                  />
                  <div className={styles.requestInfo}>
                    <p className={styles.requestMeta}>
                      Lastet opp av: <strong>{r.uploader_name || 'Anonym'}</strong>
                      {r.is_own_photo ? ' (eget bilde, autoskjult)' : ''}
                    </p>
                    {r.caption && <p className={styles.requestCaption}>{r.caption}</p>}
                    <p className={styles.requestMeta}>Rapportert av: {r.flagged_by_name}</p>
                    <div className={styles.requestBtns}>
                      <button className={styles.btnDanger} onClick={() => moderateRequest(r.id, 'delete')}>Slett</button>
                      <button className={styles.actionBtn} onClick={() => moderateRequest(r.id, 'hide')}>Skjul</button>
                      <button className={styles.actionBtn} onClick={() => moderateRequest(r.id, 'reject')}>Avvis</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
