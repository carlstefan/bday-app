import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import styles from './SuperAdminPage.module.css'

const PARTY_KEY_RE = /^[a-z0-9]+$/

export default function SuperAdminPage() {
  const navigate = useNavigate()
  const [parties, setParties] = useState([])
  const [partiesLoading, setPartiesLoading] = useState(true)

  // Create party form
  const [newKey,  setNewKey]  = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Set promoted party
  const [promotedKey, setPromotedKey] = useState('')
  const [promotingMsg, setPromotingMsg] = useState('')

  // Global ban
  const [banUserId, setBanUserId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banMsg, setBanMsg]       = useState('')

  async function loadParties() {
    setPartiesLoading(true)
    try {
      const data = await api.get('/api/parties')
      setParties(data.parties || [])
      const promoted = (data.parties || []).find(p => p.is_promoted)
      if (promoted) setPromotedKey(promoted.party_key)
    } catch {}
    setPartiesLoading(false)
  }

  useEffect(() => { loadParties() }, [])

  async function handleCreateParty(e) {
    e.preventDefault()
    setCreateError('')
    if (!PARTY_KEY_RE.test(newKey)) {
      setCreateError('Festnøkkel kan kun inneholde små bokstaver (a-z) og tall (0-9).')
      return
    }
    setCreating(true)
    try {
      await api.post('/api/parties', { json: { party_key: newKey, name: newName, description: newDesc } })
      setNewKey(''); setNewName(''); setNewDesc('')
      await loadParties()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleSetPromoted() {
    if (!promotedKey) return
    setPromotingMsg('')
    try {
      await api.patch(`/api/parties/${promotedKey}`, { json: { is_promoted: true } })
      setPromotingMsg('Fremhevet fest oppdatert!')
      await loadParties()
    } catch (err) {
      setPromotingMsg(err.message)
    }
  }

  async function handleGlobalBan(e) {
    e.preventDefault()
    setBanMsg('')
    const userId = parseInt(banUserId, 10)
    if (!userId) { setBanMsg('Ugyldig bruker-ID.'); return }
    try {
      await api.post('/api/parties/bans', { json: { user_id: userId, reason: banReason || undefined } })
      setBanMsg('Bruker globalt utestengt.')
      setBanUserId(''); setBanReason('')
    } catch (err) { setBanMsg(err.message) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Super Admin</h1>
        <button className={styles.exitBtn} onClick={() => navigate(-1)}>← Tilbake</button>
      </div>

      <div className={styles.body}>

        {/* ── All parties ── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Fester</h2>
          {partiesLoading ? <p>Laster…</p> : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nøkkel</th>
                  <th>Navn</th>
                  <th>Status</th>
                  <th>Fremhevet</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {parties.map(p => (
                  <tr key={p.id}>
                    <td><code>{p.party_key}</code></td>
                    <td>{p.name}</td>
                    <td>{p.submissions_open ? '✅ Åpen' : '🔒 Stengt'}</td>
                    <td>{p.is_promoted ? '⭐ Ja' : '–'}</td>
                    <td>
                      <a href={`/p/${p.party_key}`} className={styles.linkBtn}>Besøk</a>
                      <a href={`/p/${p.party_key}/admin`} className={styles.linkBtn}>Admin</a>
                    </td>
                  </tr>
                ))}
                {parties.length === 0 && (
                  <tr><td colSpan={5} className={styles.empty}>Ingen fester ennå.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </section>

        {/* ── Create party ── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Opprett ny fest</h2>
          <form onSubmit={handleCreateParty} className={styles.form}>
            <label className={styles.fieldLabel}>
              Festnøkkel (kun a-z og 0-9, f.eks. «wedding2026»)
              <input
                className={`${styles.input} ${newKey && !PARTY_KEY_RE.test(newKey) ? styles.inputError : ''}`}
                value={newKey}
                onChange={e => setNewKey(e.target.value.toLowerCase())}
                maxLength={32}
                placeholder="wedding2026"
                required
              />
              {newKey && !PARTY_KEY_RE.test(newKey) && (
                <span className={styles.fieldError}>Kun a-z og 0-9</span>
              )}
            </label>
            <label className={styles.fieldLabel}>
              Navn
              <input className={styles.input} value={newName} onChange={e => setNewName(e.target.value)} maxLength={120} required />
            </label>
            <label className={styles.fieldLabel}>
              Beskrivelse (valgfritt)
              <textarea className={styles.textarea} value={newDesc} onChange={e => setNewDesc(e.target.value)} maxLength={500} rows={3} />
            </label>
            {createError && <p className={styles.error}>{createError}</p>}
            <button type="submit" className={styles.btnPrimary} disabled={creating}>
              {creating ? 'Oppretter…' : 'Opprett fest'}
            </button>
          </form>
        </section>

        {/* ── Set promoted party ── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Fremhevet fest (vises på forsiden)</h2>
          <div className={styles.row}>
            <select
              className={styles.select}
              value={promotedKey}
              onChange={e => setPromotedKey(e.target.value)}
            >
              <option value="">– Velg fest –</option>
              {parties.map(p => (
                <option key={p.party_key} value={p.party_key}>{p.name} ({p.party_key})</option>
              ))}
            </select>
            <button className={styles.btnPrimary} onClick={handleSetPromoted} disabled={!promotedKey}>
              Sett som fremhevet
            </button>
          </div>
          {promotingMsg && <p className={styles.msg}>{promotingMsg}</p>}
        </section>

        {/* ── Global ban ── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Global utestengelse</h2>
          <form onSubmit={handleGlobalBan} className={styles.form}>
            <label className={styles.fieldLabel}>
              Bruker-ID
              <input className={styles.input} value={banUserId} onChange={e => setBanUserId(e.target.value)} type="number" min={1} />
            </label>
            <label className={styles.fieldLabel}>
              Grunn (valgfritt)
              <input className={styles.input} value={banReason} onChange={e => setBanReason(e.target.value)} maxLength={200} />
            </label>
            {banMsg && <p className={styles.msg}>{banMsg}</p>}
            <button type="submit" className={styles.btnDanger}>Utesteng globalt</button>
          </form>
        </section>

      </div>
    </div>
  )
}
