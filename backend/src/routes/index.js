import { Router } from 'express'
import authRouter    from './auth.js'
import photosRouter  from './photos.js'
import adminRouter   from './admin.js'
import partyRouter   from './party.js'
import partiesRouter from './parties.js'
import userRouter    from './user.js'

const router = Router()

router.use('/auth',      authRouter)
router.use('/photos',    photosRouter)   // legacy single-party endpoints (kept for backwards compat)
router.use('/admin',     adminRouter)    // legacy admin endpoints
router.use('/p/:partyKey', partyRouter)  // party-scoped photo/gallery/moderation routes
router.use('/parties',   partiesRouter)  // party management (create, settings, roles, bans)
router.use('/user',      userRouter)     // user account (display name, delete account)

export default router
