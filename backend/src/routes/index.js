import { Router } from 'express'
import authRouter from './auth.js'
import photosRouter from './photos.js'

const router = Router()

router.use('/auth', authRouter)
router.use('/photos', photosRouter)

// Admin routes added in Phase 7
// router.use('/admin', adminRouter)

export default router
