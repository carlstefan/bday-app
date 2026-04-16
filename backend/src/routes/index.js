import { Router } from 'express'
import authRouter  from './auth.js'
import photosRouter from './photos.js'
import adminRouter from './admin.js'

const router = Router()

router.use('/auth',   authRouter)
router.use('/photos', photosRouter)
router.use('/admin',  adminRouter)

export default router
