import { Router } from 'express'
import authRouter from './auth.js'

const router = Router()

router.use('/auth', authRouter)

// Photos and admin routes added in Phase 4 and Phase 7
// router.use('/photos', photosRouter)
// router.use('/admin', adminRouter)

export default router
