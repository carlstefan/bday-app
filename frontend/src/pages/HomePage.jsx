import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './HomePage.module.css'

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className={styles.page}>
      {/* Hero — placeholder until real photo is supplied */}
      <div className={styles.hero}>
        <div className={styles.heroPlaceholder}>
          <span>📷 Hero photo of Carl Stefan &amp; Trude</span>
        </div>
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>🎉 50 år!</h1>
        <p className={styles.subtitle}>
          Carl Stefan &amp; Trude feirer 50!
          <br />
          Del dine bilder fra festen her.
        </p>

        <div className={styles.actions}>
          <Link to="/upload" className={styles.btnPrimary}>
            Last opp bilder
          </Link>

          {user ? (
            <Link to="/gallery" className={styles.btnSecondary}>
              Se galleriet
            </Link>
          ) : (
            <Link to="/login" className={styles.btnSecondary}>
              Logg inn for å se galleriet
            </Link>
          )}
        </div>

        {user && (
          <p className={styles.welcome}>
            Hei, {user.display_name}!{' '}
            {user.is_admin && <Link to="/admin">Gå til admin →</Link>}
          </p>
        )}
      </div>
    </div>
  )
}
