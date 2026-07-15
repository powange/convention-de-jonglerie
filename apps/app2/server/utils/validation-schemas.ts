import { z } from 'zod'

/**
 * Schémas de validation (version minimale app2).
 * Seuls `registerSchema`, `passwordSchema` et `handleValidationError` sont
 * consommés par `layers/auth/`.
 */

// Schémas de base réutilisables
export const emailSchema = z.string().email('Email invalide').min(1, 'Email requis')

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .regex(/(?=.*[A-Z])/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/(?=.*\d)/, 'Le mot de passe doit contenir au moins un chiffre')

export const pseudoSchema = z
  .string()
  .min(3, 'Le pseudo doit contenir au moins 3 caractères')
  .max(50, 'Le pseudo ne peut pas dépasser 50 caractères')

// Schéma d'inscription
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  pseudo: pseudoSchema,
  prenom: z
    .string()
    .max(100, 'Ce champ ne peut pas dépasser 100 caractères')
    .optional()
    .or(z.literal('')),
  nom: z
    .string()
    .max(100, 'Ce champ ne peut pas dépasser 100 caractères')
    .optional()
    .or(z.literal('')),
  isVolunteer: z.boolean().optional().default(false),
  isArtist: z.boolean().optional().default(false),
  isOrganizer: z.boolean().optional().default(false),
})

/**
 * Transforme une erreur Zod en erreur HTTP 400 avec les erreurs formatées.
 */
export function handleValidationError(error: z.ZodError): never {
  const formattedErrors = (error.issues || []).reduce(
    (acc, err) => {
      const path = err.path.join('.')
      acc[path] = err.message
      return acc
    },
    {} as Record<string, string>
  )

  throw createError({
    status: 400,
    message: 'Données invalides',
    data: {
      errors: formattedErrors,
      message: 'Veuillez corriger les erreurs de saisie',
    },
  })
}
