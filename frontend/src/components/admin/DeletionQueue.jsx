import { useState } from 'react'
import { api } from '../../api/client.js'
import styles from './DeletionQueue.module.css'

// FR-A02: Updated action keys to match renamed backend endpoints
const ACTIONS = [
  { key: 'delete', label: 'Slett bildet',   className: 'danger'   },
  { key: 'reject', label: 'Avvis + gjenopprett', className: 'restore' },
  { key: 'hide',   label: 'Behold skjult', className: 'neutral'  },
]

export function DeletionQueue({ requests, onResolved, partyKey }) {
  const [busy, setBusy] = useState({})

  async function resolve(requestId, action) {
    if (busy[requestId]) return
    if (action === 'delete' && !confirm('Slett bildet permanent?')) return
    setBusy((b) => ({ ...b, [requestId]: true }))
    try {
      const url = partyKey
        ? `/api/p/${partyKey}/admin/deletion-requests/${requestId}/${action}`
        : `/api/admin/deletion-requests/${requestId}/${action}`
      await api.patch(url)
      onResolved(requestId, action)
    } catch (err) {
      alert(err.message)
      setBusy((b) => ({ ...b, [requestId]: false }))
    }
  }

  if (requests.length === 0) {
    return <p className={styles.empty}>Ingen ventende slettingsforespørsler. ✓</p>
  }

  return (
    <div className={styles.list}>
      {requests.map((req) => (
        <div key={req.id} className={styles.card}>
          <div className={styles.imgCol}>
            <img
              src={partyKey ? `/api/p/${partyKey}/photos/${req.photo_id}/thumbnail` : `/api/photos/${req.photo_id}/thumbnail`}
              alt={req.caption || req.original_name}
              className={styles.thumb}
            />
          </div>

          <div className={styles.infoCol}>
            <div className={styles.meta}>
              {req.uploader_name && (
                <span className={styles.uploader}>Lastet opp av: {req.uploader_name}</span>
              )}
              {req.caption && <p className={styles.caption}>"{req.caption}"</p>}
              <span className={styles.flagger}>
                Flagget av {req.flagged_by_name} — {new Date(req.flagged_at).toLocaleDateString('nb-NO')}
              </span>
              {/* FR-A02: Show ownership and current visibility context */}
              <div className={styles.badges}>
                {req.is_own_photo ? (
                  <span className={`${styles.badge} ${styles.badgeOwn}`}>Eget bilde</span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeOther}`}>Andres bilde</span>
                )}
                {req.is_hidden ? (
                  <span className={`${styles.badge} ${styles.badgeHidden}`}>Skjult</span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeVisible}`}>Synlig</span>
                )}
              </div>
            </div>

            <div className={styles.actions}>
              {ACTIONS.map(({ key, label, className }) => (
                <button
                  key={key}
                  className={`${styles.actionBtn} ${styles[className]}`}
                  onClick={() => resolve(req.id, key)}
                  disabled={!!busy[req.id]}
                >
                  {busy[req.id] ? '…' : label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
