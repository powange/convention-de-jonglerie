import { z } from 'zod'

export const PROGRAM_ITEM_LIMITS = {
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 5000,
  MAX_LOCATION_NAME_LENGTH: 150,
  /** Garde-fou contre une saisie automatisée qui remplirait la table d'une édition. */
  MAX_ITEMS_PER_EDITION: 500,
} as const

/**
 * Un élément se rattache à une zone **ou** à un repère, pas aux deux : la carte ne saurait pas
 * lequel montrer, et l'affichage devrait trancher arbitrairement.
 */
const zoneOuRepere = (d: { zoneId?: number | null; markerId?: number | null }) =>
  !(d.zoneId && d.markerId)

const REGLE_ZONE_OU_REPERE = {
  message: 'Choisissez une zone ou un repère, pas les deux',
  path: ['markerId'] as const,
}

/**
 * Lieu seul, pour le changer sans toucher au reste de l'élément.
 *
 * Les trois champs sont exigés ensemble, chacun pouvant être nul : le lieu se remplace d'un bloc
 * plutôt que par touches. Accepter un fragment laisserait cohabiter une zone fraîchement choisie
 * et un texte libre oublié, et la frise afficherait une précision qui ne se rapporte plus à rien.
 *
 * Défini ici plutôt que dans le point d'API, pour que la règle « une zone **ou** un repère » soit
 * énoncée au même endroit que celle du formulaire complet — deux copies auraient fini par
 * diverger, et l'une des deux voies aurait laissé passer un élément que l'autre refuse.
 */
export const programItemLocationSchema = z
  .object({
    locationName: z
      .string()
      .trim()
      .max(PROGRAM_ITEM_LIMITS.MAX_LOCATION_NAME_LENGTH)
      .nullable()
      .transform((v) => v || null),
    zoneId: z.number().int().positive().nullable(),
    markerId: z.number().int().positive().nullable(),
  })
  .refine(zoneOuRepere, REGLE_ZONE_OU_REPERE)

export type ProgramItemLocationInput = z.infer<typeof programItemLocationSchema>

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
  .refine(zoneOuRepere, REGLE_ZONE_OU_REPERE)

export type ProgramItemInput = z.infer<typeof programItemSchema>
