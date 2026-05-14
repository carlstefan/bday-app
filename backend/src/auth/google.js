import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { db } from '../db/index.js'
import { logEvent } from '../services/auditLog.js'

export function registerGoogleStrategy(passport) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true,
      },
      (req, _accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id
          // M1: Only trust the email if Google has verified it — unverified
          // addresses must never be used to grant admin privileges.
          const emailObj = profile.emails?.[0]
          const email = emailObj?.verified ? emailObj.value : null
          const displayName = profile.displayName || emailObj?.value || 'Guest'
          const isAdmin = email && adminEmails.includes(email.toLowerCase()) ? 1 : 0

          // Find existing user
          let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId)

          if (user) {
            // Sync is_admin in both directions — upgrades and revocations
            if (user.is_admin !== isAdmin) {
              db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin, user.id)
              user.is_admin = isAdmin
            }
            logEvent('login', user.id, req.ip, { method: 'google', success: true })
          } else {
            // Create new user
            const result = db
              .prepare(
                `INSERT INTO users (google_id, display_name, email, is_admin)
                 VALUES (@google_id, @display_name, @email, @is_admin)`
              )
              .run({ google_id: googleId, display_name: displayName, email, is_admin: isAdmin })

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)
            logEvent('register', user.id, req.ip, { method: 'google', email, display_name: displayName })
          }

          return done(null, {
            id: user.id,
            display_name: user.display_name,
            email: user.email,
            is_admin: user.is_admin,
          })
        } catch (err) {
          return done(err)
        }
      }
    )
  )
}
