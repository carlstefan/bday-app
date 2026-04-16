import { useState } from 'react'
import { api } from '../../api/client.js'
import styles from './DeletionQueue.module.css'

const ACTIONS = [
  { key: 'accept',      label: 'Slett bildet',   className: 'danger' },
  { key: 'deny',        label: 'Behold + vis',   className: 'restore' },
  { key: 'leave-hidden', label: 'Behold skjult', className: 'neutral' },
]

export function DeletionQueue({ requests, onResolved }) {
  const [busy, setBusy] = useState({})

  async function resolve(requestId, action) {
    if (busy[requestId]) return
    if (action === 'accept' && !confirm('Slett bildet permanent?')) return
    setBusy((b) => ({ ...b, [requestId]: true }))
    try {
      await api.patch(`/api/admin/deletion-requests/${requestId}/${action}`)
      onResolved(requestId)
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
              src={`/api/photos/${req.photo_id}/thumbnail`}
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
