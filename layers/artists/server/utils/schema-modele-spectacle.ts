/**
 * Validation d'un modèle de spectacle (« preset » du profil d'un artiste), commune à app1 et
 * Flowvent. Chaque app la réexporte depuis son `#server/utils/validation-schemas`.
 */
import { z } from 'zod'

import { urlSchema } from '#core/server/socle/validation-generique'

export const showPresetSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Le nom du preset doit contenir au moins 2 caractères')
      .max(100, 'Le nom du preset ne peut pas dépasser 100 caractères'),

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

    // Infos spectacle
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

    // Personnes supplémentaires
    additionalPerformersCount: z.coerce
      .number()
      .int('Le nombre doit être un entier')
      .min(0, 'Le nombre ne peut pas être négatif')
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
          // Téléphone facultatif pour un preset : vide autorisé, sinon 6 à 20 caractères
          phone: z
            .string()
            .max(20, 'Le numéro de téléphone ne peut pas dépasser 20 caractères')
            .refine(
              (val) => !val || val.length >= 6,
              'Le numéro de téléphone doit contenir au moins 6 caractères'
            )
            .optional()
            .default(''),
        })
      )
      .optional()
      .default([]),
  })
  .refine(
    (data) => {
      const count = data.additionalPerformersCount || 0
      const performers = data.additionalPerformers || []
      return performers.length === count
    },
    {
      message: 'Le nombre de personnes supplémentaires doit correspondre aux informations fournies',
      path: ['additionalPerformers'],
    }
  )
