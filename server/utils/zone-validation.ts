import { z } from 'zod'

// EDITION_ZONE_TYPES et ZONE_LIMITS sont auto-importés depuis shared/utils/zone-types.ts

/**
 * Schéma Zod pour le type de zone (enum)
 */
export const zoneTypeSchema = z.enum(EDITION_ZONE_TYPES)

/**
 * Schéma Zod pour la création d'une zone
 */
export const createZoneSchema = z.object({
  name: z.string().min(1).max(ZONE_LIMITS.MAX_NAME_LENGTH),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide (format #RRGGBB)'),
  coordinates: z.array(z.array(z.number()).length(2)).min(ZONE_LIMITS.MIN_POLYGON_POINTS),
  zoneType: zoneTypeSchema.default('OTHER'),
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
  zoneType: zoneTypeSchema.optional(),
})

/**
 * Schéma Zod pour la création d'un marqueur
 */
export const createMarkerSchema = z.object({
  name: z.string().min(1).max(ZONE_LIMITS.MAX_NAME_LENGTH),
  description: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  markerType: zoneTypeSchema.default('OTHER'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide (format #RRGGBB)')
    .optional()
    .nullable(),
})

/**
 * Schéma Zod pour la mise à jour d'un marqueur
 */
export const updateMarkerSchema = z.object({
  name: z.string().min(1).max(ZONE_LIMITS.MAX_NAME_LENGTH).optional(),
  description: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  markerType: zoneTypeSchema.optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide (format #RRGGBB)')
    .optional()
    .nullable(),
})

export type CreateZoneInput = z.infer<typeof createZoneSchema>
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>
export type CreateMarkerInput = z.infer<typeof createMarkerSchema>
export type UpdateMarkerInput = z.infer<typeof updateMarkerSchema>
