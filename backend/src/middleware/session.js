import session from 'express-session'
import connectSqlite3 from 'connect-sqlite3'
import path from 'path'

const SQLiteStore = connectSqlite3(session)

const dbDir = path.dirname(process.env.DB_PATH || path.join(process.cwd(), 'data', 'db.sqlite'))

export const sessionMiddleware = session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: dbDir }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
})
