// Gallery views are implemented in Phase 6.
// This is a placeholder that confirms auth is working and photos load.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import styles from './GalleryPage.module.css'

export default function GalleryPage() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.get('/api/photos?limit=50')
      .then((d) => setPhotos(d.photos))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.page}><span>Laster bilder…</span></div>
  if (error)   return <div className={styles.page}><span className={styles.error}>{error}</span></div>

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Galleri <span className={styles.count}>({photos.length})</span></h1>
      <p className={styles.note}>Full galleri-visning kommer i neste fase. Her er en enkel oversikt:</p>

      <div className={styles.grid}>
        {photos.map((photo) => (
          <div key={photo.id} className={styles.thumb}>
            <img
              src={`/api/photos/${photo.id}/thumbnail`}
              alt={photo.caption || photo.original_name}
              loading="lazy"
            />
            {photo.uploader_name && (
              <span className={styles.uploader}>{photo.uploader_name}</span>
            )}
          </div>
        ))}
      </div>

      {photos.length === 0 && (
        <p className={styles.empty}>Ingen bilder ennå. <Link to="/upload">Last opp det første!</Link></p>
      )}

      <p className={styles.backLink}><Link to="/">← Tilbake</Link></p>
    </div>
  )
}
