import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './HomePage.module.css'

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [promotedKey, setPromotedKey] = useState(null)
  const [parties, setParties] = useState([])

  useEffect(() => {
    fetch('/api/parties/public', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { parties: [] })
      .then(data => {
        const all = data.parties || []
        setParties(all)
        const promoted = all.find(p => p.is_promoted)
        if (promoted) {
          navigate(`/p/${promoted.party_key}`, { replace: true })
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [navigate])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: '#7a6655' }}>
        Laster…
      </div>
    )
  }

  // No promoted party — show explanatory fallback
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <img
          src="/hero.jpg"
          alt="Bildefest"
          className={styles.heroImg}
        />
        <div className={styles.heroOverlay} />
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>🎉 Bildefest</h1>
        <p className={styles.subtitle}>
          Del og se bilder fra uforglemmelige fester.
        </p>

        {parties.filter(p => p.submissions_open).length > 0 && (
          <div className={styles.actions}>
            {parties.filter(p => p.submissions_open).map(p => (
              <Link key={p.party_key} to={`/p/${p.party_key}`} className={styles.btnPrimary}>
                {p.name}
              </Link>
            ))}
          </div>
        )}

        {user?.is_super_admin && (
          <p className={styles.welcome}>
            <Link to="/admin">Super Admin-panel →</Link>
          </p>
        )}
      </div>
    </div>
  )
}
