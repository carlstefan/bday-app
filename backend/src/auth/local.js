import { Strategy as LocalStrategy } from 'passport-local'
import bcrypt from 'bcrypt'
import { db } from '../db/index.js'

export function registerLocalStrategy(passport) {
  passport.use(
    new LocalStrategy(
      { usernameField: 'username', passwordField: 'password' },
      (username, password, done) => {
        try {
          const user = db
            .prepare('SELECT * FROM users WHERE username = ?')
            .get(username)

          if (!user) {
            return done(null, false, { message: 'Invalid username or password.' })
          }

          const match = bcrypt.compareSync(password, user.password_hash)
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
