import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1).max(60).trim(),
  password: z.string().min(1).max(128),
})
