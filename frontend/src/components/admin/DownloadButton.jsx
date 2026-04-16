import { useState } from 'react'
import styles from './DownloadButton.module.css'

export function DownloadButton({ photoCount }) {
  const [downloading, setDownloading] = useState(false)

  function handleDownload() {
    setDownloading(true)
    // Trigger download via a temporary anchor — the browser streams it
    const a = document.createElement('a')
    a.href = '/api/admin/download'
    a.download = 'party-photos.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Give the browser a moment to initiate the download
    setTimeout(() => setDownloading(false), 3000)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.info}>
        <h3 className={styles.title}>Last ned alle bilder</h3>
        <p className={styles.desc}>
          Laster ned {photoCount} bilde{photoCount !== 1 ? 'r' : ''} som en ZIP-fil.
          Filnavnene inkluderer dato og navn på den som lastet opp.
        </p>
      </div>
      <button
        className={styles.btn}
        onClick={handleDownload}
        disabled={downloading || photoCount === 0}
      >
        {downloading ? '⏳ Forbereder…' : '⬇ Last ned ZIP'}
      </button>
    </div>
  )
}
