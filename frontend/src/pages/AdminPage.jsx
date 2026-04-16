import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ModerationGrid } from '../components/admin/ModerationGrid.jsx'
import { DeletionQueue }  from '../components/admin/DeletionQueue.jsx'
import { DownloadButton } from '../components/admin/DownloadButton.jsx'
import styles from './AdminPage.module.css'

const TABS = ['Alle bilder', 'Slettingsforespørsler', 'Last ned']

export default function AdminPage() {
  const { user }                        = useAuth()
  const [tab, setTab]                   = useState(0)
  const [photos, setPhotos]             = useState([])
  const [requests, setRequests]         = useState([])
  const [loadingPhotos, setLoadingPhotos]     = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(true)

  useEffect(() => {
    api.get('/api/admin/photos')
      .then((d) => setPhotos(d.photos))
      .catch((err) => alert(err.message))
      .finally(() => setLoadingPhotos(false))

    api.get('/api/admin/deletion-requests')
      .then((d) => setRequests(d.requests))
      .catch((err) => alert(err.message))
      .finally(() => setLoadingRequests(false))
  }, [])

  function handlePhotoUpdate(photoId, patch) {
    setPhotos((prev) => prev.map((p) => p.id === photoId ? { ...p, ...patch } : p))
  }

  function handleRequestResolved(requestId) {
    setRequests((prev) => prev.filter((r) => r.id !== requestId))
    // Remove photo from moderation grid if it was accepted (deleted)
    const req = requests.find((r) => r.id === requestId)
    if (req) {
      setPhotos((prev) => prev.filter((p) => p.id !== req.photo_id))
    }
  }

  const pendingCount = requests.length

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <h1 className={styles.title}>Admin</h1>
            <p className={styles.subtitle}>Hei, {user?.display_name}!</p>
          </div>
          <Link to="/gallery" className={styles.galleryLink}>← Galleri</Link>
        </div>

        <nav className={styles.tabs}>
          {TABS.map((label, i) => (
            <button
              key={i}
              className={`${styles.tab} ${tab === i ? styles.tabActive : ''}`}
              onClick={() => setTab(i)}
            >
              {label}
              {i === 1 && pendingCount > 0 && (
                <span className={styles.badge}>{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className={styles.main}>
        {/* Tab 0 — All photos */}
        {tab === 0 && (
          <section>
            <p className={styles.sectionNote}>
              {photos.length} bilde{photos.length !== 1 ? 'r' : ''} totalt.
              Skjulte bilder er nedtonet. Klikk for å vise/skjule.
            </p>
            {loadingPhotos
              ? <p className={styles.loading}>Laster…</p>
              : <ModerationGrid photos={photos} onUpdate={handlePhotoUpdate} />
            }
          </section>
        )}

        {/* Tab 1 — Deletion requests */}
        {tab === 1 && (
          <section>
            <p className={styles.sectionNote}>
              {pendingCount === 0
                ? 'Ingen ventende forespørsler.'
                : `${pendingCount} ventende slettingsforespørsel${pendingCount > 1 ? 'er' : ''}.`}
            </p>
            {loadingRequests
              ? <p className={styles.loading}>Laster…</p>
              : <DeletionQueue requests={requests} onResolved={handleRequestResolved} />
            }
          </section>
        )}

        {/* Tab 2 — Download */}
        {tab === 2 && (
          <section>
            <DownloadButton photoCount={photos.filter((p) => !p.is_hidden).length} />
          </section>
        )}
      </main>
    </div>
  )
}
