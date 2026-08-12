import { z } from 'zod'

export const PROGRAM_ITEM_LIMITS = {
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 5000,
  MAX_LOCATION_NAME_LENGTH: 150,
  /** Garde-fou contre une saisie automatisée qui remplirait la table d'une édition. */
  MAX_ITEMS_PER_EDITION: 500,
} as const

/**
 * Élément de programmation, à la création comme à la modification.
 *
 * La modification attend l'objet complet plutôt qu'un fragment : c'est ce qu'envoie le formulaire,
 * et surtout la cohérence « fin après début » ne se vérifie pas sur un fragment sans relire la
 * valeur en base — ce qui ouvrirait la porte à un créneau inversé au premier appel partiel.
 *
 * L'heure de fin est facultative : un accueil qui ouvre ou une scène ouverte n'en annoncent pas.
 */
export const programItemSchema = z
  .object({
    title: z.string().trim().min(1).max(PROGRAM_ITEM_LIMITS.MAX_TITLE_LENGTH),
    description: z
      .string()
      .trim()
      .max(PROGRAM_ITEM_LIMITS.MAX_DESCRIPTION_LENGTH)
      .optional()
      .nullable(),
    startDateTime: z.coerce.date(),
    endDateTime: z.coerce.date().optional().nullable(),
    locationName: z
      .string()
      .trim()
      .max(PROGRAM_ITEM_LIMITS.MAX_LOCATION_NAME_LENGTH)
      .optional()
      .nullable(),
    zoneId: z.number().int().positive().optional().nullable(),
    markerId: z.number().int().positive().optional().nullable(),
    isPublic: z.boolean().optional(),
  })
  .refine((d) => !d.endDateTime || d.endDateTime > d.startDateTime, {
    message: 'La fin doit être postérieure au début',
    path: ['endDateTime'],
  })
  /**
   * Un élément se rattache à une zone **ou** à un repère, pas aux deux : la carte ne saurait pas
   * lequel montrer, et l'affichage devrait trancher arbitrairement.
   */
  .refine((d) => !(d.zoneId && d.markerId), {
    message: 'Choisissez une zone ou un repère, pas les deux',
    path: ['markerId'],
  })

export type ProgramItemInput = z.infer<typeof programItemSchema>
