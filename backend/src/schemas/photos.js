import { z } from 'zod'

// Strip basic HTML tags from text fields
function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').trim()
}

export const uploadBodySchema = z.object({
  uploader_name: z
    .string()
    .max(60, 'Uploader name must be 60 characters or fewer.')
    .transform(stripHtml)
    .optional()
    .or(z.literal('')),
  caption: z
    .string()
    .max(200, 'Caption must be 200 characters or fewer.')
    .transform(stripHtml)
    .optional()
    .or(z.literal('')),
})

export const captionUpdateSchema = z.object({
  caption: z
    .string()
    .max(200, 'Caption must be 200 characters or fewer.')
    .transform(stripHtml),
})

export const photoIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})
