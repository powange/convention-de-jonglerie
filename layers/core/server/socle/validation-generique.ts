/**
 * Validation générique, commune à app1 et Flowvent : URL facultative, nettoyage des chaînes avant
 * validation. Chaque app la réexporte depuis son `#server/utils/validation-schemas`.
 */
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js'
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

/**
 * Validation d'un numéro de téléphone international.
 * Accepte uniquement le format E.164 (`+[code pays][numéro]`) parsable par
 * libphonenumber-js. La chaîne vide / null est gérée par les schémas appelants
 * (optionnel ou non).
 */
export function isInternationalPhoneValid(value: string): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed.startsWith('+')) return false
  return isValidPhoneNumber(trimmed)
}

/**
 * Normalise un numéro en E.164 si possible, sinon retourne la valeur trimée.
 */
export function normalizePhoneE164(value: string | null | undefined): string {
  if (!value) return ''
  const parsed = parsePhoneNumberFromString(value.trim())
  return parsed?.isValid() ? parsed.number : value.trim()
}

export const phoneSchema = z
  .string()
  .nullable()
  .optional()
  .refine((val) => !val || isInternationalPhoneValid(val), 'Numéro de téléphone invalide')
