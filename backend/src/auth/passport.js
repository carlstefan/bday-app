import passport from 'passport'
import { db } from '../db/index.js'

// Serialize: store only user id in session
passport.serializeUser((user, done) => {
  done(null, user.id)
})

// Deserialize: fetch full user from DB on each request
passport.deserializeUser((id, done) => {
  try {
    const user = db.prepare('SELECT id, display_name, email, is_admin, is_super_admin FROM users WHERE id = ?').get(id)
    done(null, user || false)
  } catch (err) {
    done(err)
  }
})

// Register the appropriate strategy based on AUTH_MODE
const authMode = process.env.AUTH_MODE || 'local'

if (authMode === 'google') {
  const { registerGoogleStrategy } = await import('./google.js')
  registerGoogleStrategy(passport)
} else {
  const { registerLocalStrategy } = await import('./local.js')
  registerLocalStrategy(passport)
}

export default passport
