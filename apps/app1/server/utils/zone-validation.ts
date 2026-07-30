import { z } from 'zod'

import { EDITION_ZONE_TYPES, ZONE_LIMITS } from '~~/shared/utils/zone-types'

/**
 * Schéma Zod pour le type de zone (enum)
 */
export const zoneTypeSchema = z.enum(EDITION_ZONE_TYPES)

/**
 * Schéma Zod pour un tableau de types de zone (au moins 1 type requis)
 */
export const zoneTypesArraySchema = z.array(zoneTypeSchema).min(1)

/**
 * Schéma Zod pour la création d'une zone
 */
export const createZoneSchema = z.object({
  name: z.string().min(1).max(ZONE_LIMITS.MAX_NAME_LENGTH),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide (format #RRGGBB)'),
  coordinates: z.array(z.array(z.number()).length(2)).min(ZONE_LIMITS.MIN_POLYGON_POINTS),
  zoneTypes: zoneTypesArraySchema.default(['OTHER']),
})

/**
 * Schéma Zod pour la mise à jour d'une zone
 */
export const updateZoneSchema = z.object({
  name: z.string().min(1).max(ZONE_LIMITS.MAX_NAME_LENGTH).optional(),
  description: z.string().optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide (format #RRGGBB)')
    .optional(),
  coordinates: z
    .array(z.array(z.number()).length(2))
    .min(ZONE_LIMITS.MIN_POLYGON_POINTS)
    .optional(),
  zoneTypes: zoneTypesArraySchema.optional(),
})

/**
 * Schéma Zod pour la création d'un marqueur
 */
export const createMarkerSchema = z.object({
  name: z.string().min(1).max(ZONE_LIMITS.MAX_NAME_LENGTH),
  description: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  markerTypes: zoneTypesArraySchema.default(['OTHER']),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide (format #RRGGBB)')
    .optional()
    .nullable(),
  // Zone à laquelle ce marqueur est rattaché (son entrée, son accès). `null` détache.
  zoneId: z.number().int().positive().optional().nullable(),
})

/**
 * Schéma Zod pour la mise à jour d'un marqueur
 */
export const updateMarkerSchema = z.object({
  name: z.string().min(1).max(ZONE_LIMITS.MAX_NAME_LENGTH).optional(),
  description: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  markerTypes: zoneTypesArraySchema.optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide (format #RRGGBB)')
    .optional()
    .nullable(),
  // Absent = inchangé, `null` = détaché. Confondre les deux détacherait un marqueur que
  // personne n'a demandé à détacher — un simple renommage suffirait à le faire.
  zoneId: z.number().int().positive().optional().nullable(),
})

/**
 * Vérifie qu'une zone appartient bien à l'édition avant d'y rattacher un marqueur.
 *
 * Sans ce contrôle, l'identifiant venant du corps de la requête suffirait à rattacher l'entrée
 * d'une salle à la zone d'une autre édition — la clé étrangère l'accepterait sans broncher, et
 * la carte afficherait un rattachement invisible depuis les deux côtés.
 */
export async function resolveMarkerZoneId(
  editionId: number,
  zoneId: number | null | undefined
): Promise<number | null | undefined> {
  if (zoneId === undefined) return undefined
  if (zoneId === null) return null

  const zone = await prisma.editionZone.findFirst({
    where: { id: zoneId, editionId },
    select: { id: true },
  })
  if (!zone) {
    throw createError({ status: 400, message: 'Zone introuvable pour cette édition' })
  }
  return zone.id
}

export type CreateZoneInput = z.infer<typeof createZoneSchema>
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>
export type CreateMarkerInput = z.infer<typeof createMarkerSchema>
export type UpdateMarkerInput = z.infer<typeof updateMarkerSchema>
