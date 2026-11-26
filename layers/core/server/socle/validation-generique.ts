/**
 * Validation générique, commune à app1 et Flowvent : URL facultative, nettoyage des chaînes avant
 * validation. Chaque app la réexporte depuis son `#server/utils/validation-schemas`.
 */
import { z } from 'zod'

export const urlSchema = z
  .string()
  .url('URL invalide')
  .max(191, "L'URL ne peut pas dépasser 191 caractères")
  .nullable()
  .optional()
  .or(z.literal(''))

// Fonction utilitaire pour sanitiser les données avant validation
export function sanitizeData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  const sanitized = { ...(data as Record<string, unknown>) }

  // Trim des chaînes de caractères
  Object.keys(sanitized).forEach((key) => {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = (sanitized[key] as string).trim()
      // Conversion en minuscules pour les emails
      if (key === 'email') {
        sanitized[key] = (sanitized[key] as string).toLowerCase()
      }
    }
  })

  return sanitized
}

// Fonction utilitaire pour valider et nettoyer les données
export function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const sanitizedData = sanitizeData(data)
  return schema.parse(sanitizedData)
}
