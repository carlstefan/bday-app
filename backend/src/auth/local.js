import { Strategy as LocalStrategy } from 'passport-local'
import bcrypt from 'bcrypt'
import { db } from '../db/index.js'

export function registerLocalStrategy(passport) {
  passport.use(
    new LocalStrategy(
      { usernameField: 'username', passwordField: 'password' },
      // M2: Use async bcrypt.compare so the ~150-300ms hash check does not
      // block the Node.js event loop for other concurrent requests.
      async (username, password, done) => {
        try {
          const user = db
            .prepare('SELECT * FROM users WHERE username = ?')
            .get(username)

          if (!user) {
            return done(null, false, { message: 'Invalid username or password.' })
          }

          const match = await bcrypt.compare(password, user.password_hash)
          if (!match) {
            return done(null, false, { message: 'Invalid username or password.' })
          }

          // Return only the fields we want in req.user
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
