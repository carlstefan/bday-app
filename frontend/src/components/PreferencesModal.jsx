import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import styles from './PreferencesModal.module.css'

export default function PreferencesModal({ onClose }) {
  const { user, refetch, setUser } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab]               = useState('name') // 'name' | 'delete'
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [nameError, setNameError]   = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError]   = useState('')
  const [deleting, setDeleting]         = useState(false)

  async function handleSaveName(e) {
    e.preventDefault()
    setNameError('')
    setNameSuccess(false)
    if (!displayName.trim()) { setNameError('Visningsnavnet kan ikke være tomt.'); return }
    setNameSaving(true)
    try {
      await api.patch('/api/user/display-name', { json: { display_name: displayName.trim() } })
      await refetch()
      setNameSuccess(true)
    } catch (err) {
      setNameError(err.message || 'Noe gikk galt.')
    } finally {
      setNameSaving(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('')
    setDeleting(true)
    try {
      await api.delete('/api/user', {})
      setUser(null)
      navigate('/')
    } catch (err) {
      setDeleteError(err.message || 'Noe gikk galt.')
      setDeleting(false)
    }
  }

  return (
    <div className={styles.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Brukerinnstillinger">
        <div className={styles.header}>
          <h2 className={styles.title}>Innstillinger</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Lukk">✕</button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'name' ? styles.tabActive : ''}`}
            onClick={() => setTab('name')}
          >Endre navn</button>
          <button
            className={`${styles.tab} ${tab === 'delete' ? styles.tabActive : ''}`}
            onClick={() => setTab('delete')}
          >Slett konto</button>
        </div>

        {tab === 'name' && (
          <form className={styles.body} onSubmit={handleSaveName}>
            <p className={styles.desc}>
              Endre visningsnavnet ditt. Eksisterende bilder beholder det opprinnelige navnet.
            </p>
            <input
              className={styles.input}
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={60}
              placeholder="Visningsnavn"
              autoFocus
            />
            {nameError && <p className={styles.error}>{nameError}</p>}
            {nameSuccess && <p className={styles.success}>Navn oppdatert!</p>}
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={nameSaving}
            >
              {nameSaving ? 'Lagrer…' : 'Lagre'}
            </button>
          </form>
        )}

        {tab === 'delete' && (
          <div className={styles.body}>
            {!confirmDelete ? (
              <>
                <p className={styles.desc}>
                  Er du sikker? Bildene dine forblir i galleriet, men kontoen og innloggingstilgangen din fjernes permanent.
                </p>
                <button className={styles.btnDanger} onClick={() => setConfirmDelete(true)}>
                  Slett konto
                </button>
              </>
            ) : (
              <>
                <p className={styles.desc}>
                  <strong>Dette kan ikke angres.</strong> Bildene dine forblir i galleriet, men kontoen og innloggingstilgangen din fjernes permanent.
                </p>
                {deleteError && <p className={styles.error}>{deleteError}</p>}
                <div className={styles.confirmRow}>
                  <button className={styles.btnDanger} onClick={handleDeleteAccount} disabled={deleting}>
                    {deleting ? 'Sletter…' : 'Bekreft sletting'}
                  </button>
                  <button className={styles.btnSecondary} onClick={() => setConfirmDelete(false)}>
                    Avbryt
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
