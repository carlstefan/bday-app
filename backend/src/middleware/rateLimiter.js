import rateLimit from 'express-rate-limit'

/** Upload: 100 requests per IP per hour (TR-S06) */
export const uploadLimiter = rateLimit({
  windowMs:         60 * 60 * 1000,
  max:              100,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many uploads from this IP. Please try again in an hour.' },
})

/** Login: 20 attempts per IP per hour (TR-S06) */
export const loginLimiter = rateLimit({
  windowMs:         60 * 60 * 1000,
  max:              20,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many login attempts. Please try again later.' },
})

/** General API: 200 requests per IP per 15 minutes */
export const apiLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              200,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many requests. Please slow down.' },
})
