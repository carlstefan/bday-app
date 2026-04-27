import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const { user, loading, refetch } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rawNext = searchParams.get('next') || ''
  // H1: Reject protocol-relative paths (//evil.com) that browsers resolve externally
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/\\')
    ? rawNext
    : '/gallery'

  const [authMode, setAuthMode] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate(next, { replace: true })
    }
  }, [user, loading])

  // Fetch auth mode from backend
  useEffect(() => {
    api.get('/api/auth/mode').then((d) => setAuthMode(d.mode)).catch(() => setAuthMode('local'))
  }, [])

  async function handleLocalLogin(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.post('/api/auth/login', { json: { username, password } })
      await refetch()
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || authMode === null) {
    return <div className={styles.page}><span className={styles.loading}>Laster…</span></div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>🎉 Logg inn</h1>
        <p className={styles.subtitle}>For å se galleriet må du logge inn.</p>

        {authMode === 'google' ? (
          <a href="/api/auth/google" className={styles.googleBtn}>
            <img src="/google-logo.svg" alt="" width={20} height={20} />
            Logg inn med Google
          </a>
        ) : (
          <form onSubmit={handleLocalLogin} className={styles.form}>
            {error && <p className={styles.error}>{error}</p>}

            <label className={styles.label}>
              Brukernavn
              <input
                className={styles.input}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className={styles.label}>
              Passord
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button className={styles.submitBtn} type="submit" disabled={submitting}>
              {submitting ? 'Logger inn…' : 'Logg inn'}
            </button>
          </form>
        )}

        <p className={styles.uploadLink}>
          Vil du bare laste opp bilder?{' '}
          <Link to="/upload">Last opp uten å logge inn</Link>
        </p>
      </div>
    </div>
  )
}
