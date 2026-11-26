/**
 * Validation des candidatures aux appels à spectacles (dépôt, et décision des organisateurs),
 * commune à app1 et Flowvent. Chaque app la réexporte depuis son `#server/utils/validation-schemas`.
 */
import { z } from 'zod'

import { isInternationalPhoneValid, urlSchema } from '#core/server/socle/validation-generique'

/**
 * Construit le schéma de candidature de spectacle.
 *
 * Le téléphone (contact principal + chaque artiste participant) est
 * conditionnellement obligatoire selon le réglage `requirePhone` de
 * l'appel à spectacles. Quand il est facultatif, on accepte la chaîne
 * vide ou une valeur de 6 à 20 caractères.
 */
export function createShowApplicationSchema(
  options: { phoneRequired: boolean } = { phoneRequired: true }
) {
  const phoneSchema = options.phoneRequired
    ? z.string().refine(isInternationalPhoneValid, {
        message:
          'Numéro de téléphone invalide (format international attendu, ex: +33 6 12 34 56 78)',
      })
    : z.string().refine((v) => v === '' || isInternationalPhoneValid(v), {
        message:
          'Numéro de téléphone invalide (format international attendu, ex: +33 6 12 34 56 78)',
      })

  return z
    .object({
      // Informations personnelles (obligatoires, mises à jour dans le profil)
      lastName: z
        .string()
        .min(2, 'Le nom doit contenir au moins 2 caractères')
        .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
      firstName: z
        .string()
        .min(2, 'Le prénom doit contenir au moins 2 caractères')
        .max(100, 'Le prénom ne peut pas dépasser 100 caractères'),
      phone: phoneSchema,

      // Infos artiste
      artistName: z
        .string()
        .min(2, 'Le nom de scène doit contenir au moins 2 caractères')
        .max(100, 'Le nom de scène ne peut pas dépasser 100 caractères'),
      artistBio: z
        .string()
        .max(3000, 'La biographie ne peut pas dépasser 3000 caractères')
        .nullable()
        .optional(),
      portfolioUrl: urlSchema,
      videoUrl: urlSchema,
      socialLinks: z
        .string()
        .max(2000, 'Les liens réseaux sociaux ne peuvent pas dépasser 2000 caractères')
        .nullable()
        .optional(),

      // Infos spectacle proposé
      showTitle: z
        .string()
        .min(3, 'Le titre du spectacle doit contenir au moins 3 caractères')
        .max(200, 'Le titre du spectacle ne peut pas dépasser 200 caractères'),
      showDescription: z
        .string()
        .min(20, 'La description doit contenir au moins 20 caractères')
        .max(5000, 'La description ne peut pas dépasser 5000 caractères'),
      showDuration: z.coerce
        .number()
        .int('La durée doit être un nombre entier')
        .min(1, 'La durée doit être au moins 1 minute')
        .max(180, 'La durée ne peut pas dépasser 180 minutes'),
      showCategory: z
        .string()
        .max(100, 'La catégorie ne peut pas dépasser 100 caractères')
        .nullable()
        .optional(),
      technicalNeeds: z
        .string()
        .max(3000, 'Les besoins techniques ne peuvent pas dépasser 3000 caractères')
        .nullable()
        .optional(),
      stageSetup: z
        .string()
        .max(3000, 'La mise en place sur scène ne peut pas dépasser 3000 caractères')
        .nullable()
        .optional(),
      // Personnes supplémentaires dans le spectacle
      additionalPerformersCount: z.coerce
        .number()
        .int('Le nombre doit être un entier')
        .min(1, 'Le spectacle doit avoir au moins 1 artiste')
        .max(50, 'Le nombre ne peut pas dépasser 50'),
      additionalPerformers: z
        .array(
          z.object({
            lastName: z
              .string()
              .min(2, 'Le nom doit contenir au moins 2 caractères')
              .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
            firstName: z
              .string()
              .min(2, 'Le prénom doit contenir au moins 2 caractères')
              .max(100, 'Le prénom ne peut pas dépasser 100 caractères'),
            email: z.string().email('Email invalide'),
            phone: phoneSchema,
          })
        )
        .optional()
        .default([]),

      // Logistique
      accommodationNeeded: z.boolean().optional().default(false),
      accommodationNotes: z
        .string()
        .max(1000, "Les notes d'hébergement ne peuvent pas dépasser 1000 caractères")
        .nullable()
        .optional(),
      departureCity: z
        .string()
        .max(100, 'La ville de départ ne peut pas dépasser 100 caractères')
        .nullable()
        .optional(),
    })
    .refine(
      (data) => {
        // Vérifier que le nombre de personnes supplémentaires correspond au tableau
        const count = data.additionalPerformersCount || 0
        const performers = data.additionalPerformers || []
        return performers.length === count
      },
      {
        message:
          'Le nombre de personnes supplémentaires doit correspondre aux informations fournies',
        path: ['additionalPerformers'],
      }
    )
}

// Schéma par défaut (téléphone obligatoire) — conservé pour rétrocompat
// avec les imports qui ne disposent pas du flag requirePhone du show call.
export const showApplicationSchema = createShowApplicationSchema({ phoneRequired: true })

// Schéma pour la mise à jour d'une candidature (statut, notes, spectacle associé)
export const showApplicationStatusSchema = z.object({
  status: z
    .enum(['PENDING', 'ACCEPTED', 'REJECTED'], {
      message: 'Statut invalide',
    })
    .optional(),
  organizerNotes: z
    .string()
    .max(3000, 'Les notes ne peuvent pas dépasser 3000 caractères')
    .nullable()
    .optional(),
  showId: z.number().int().positive().nullable().optional(),
  showDescription: z
    .string()
    .max(10000, 'La description ne peut pas dépasser 10000 caractères')
    .optional(),
})
