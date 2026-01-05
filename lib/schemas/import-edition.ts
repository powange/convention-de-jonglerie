/**
 * Schéma Zod partagé pour l'import d'édition
 *
 * Ce schéma est utilisé à la fois côté client (validation préliminaire)
 * et côté serveur (validation finale).
 */

import { z } from 'zod'

/**
 * Pattern regex pour les dates ISO
 * Accepte:
 * - "2025-07-15" (date simple)
 * - "2025-07-15T14:00:00" (avec heure)
 * - "2025-07-15T14:00:00Z" (UTC)
 * - "2025-07-15T14:00:00.000Z" (avec millisecondes)
 */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/

/**
 * Schéma pour la convention
 */
export const conventionImportSchema = z.object({
  name: z.string().min(1, 'Le nom de la convention est requis'),
  email: z.string().email('Email invalide'),
  description: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
})

/**
 * Schéma pour les caractéristiques booléennes d'une édition
 */
export const editionFeaturesSchema = z.object({
  hasFoodTrucks: z.boolean().optional(),
  hasKidsZone: z.boolean().optional(),
  acceptsPets: z.boolean().optional(),
  hasTentCamping: z.boolean().optional(),
  hasTruckCamping: z.boolean().optional(),
  hasGym: z.boolean().optional(),
  hasFamilyCamping: z.boolean().optional(),
  hasSleepingRoom: z.boolean().optional(),
  hasFireSpace: z.boolean().optional(),
  hasGala: z.boolean().optional(),
  hasOpenStage: z.boolean().optional(),
  hasConcert: z.boolean().optional(),
  hasCantine: z.boolean().optional(),
  hasAerialSpace: z.boolean().optional(),
  hasSlacklineSpace: z.boolean().optional(),
  hasToilets: z.boolean().optional(),
  hasShowers: z.boolean().optional(),
  hasAccessibility: z.boolean().optional(),
  hasWorkshops: z.boolean().optional(),
  hasCashPayment: z.boolean().optional(),
  hasCreditCardPayment: z.boolean().optional(),
  hasAfjTokenPayment: z.boolean().optional(),
  hasATM: z.boolean().optional(),
  hasLongShow: z.boolean().optional(),
  isOnline: z.boolean().optional(),
})

/**
 * Liste des caractéristiques pour la documentation/UI
 */
export const EDITION_FEATURES = [
  { key: 'hasFoodTrucks', label: 'Food trucks' },
  { key: 'hasKidsZone', label: 'Espace enfants' },
  { key: 'acceptsPets', label: 'Animaux acceptés' },
  { key: 'hasTentCamping', label: 'Camping tente' },
  { key: 'hasTruckCamping', label: 'Camping véhicule' },
  { key: 'hasFamilyCamping', label: 'Camping famille' },
  { key: 'hasGym', label: 'Gymnase' },
  { key: 'hasCantine', label: 'Cantine' },
  { key: 'hasShowers', label: 'Douches' },
  { key: 'hasToilets', label: 'Toilettes' },
  { key: 'hasSleepingRoom', label: 'Dortoir' },
  { key: 'hasWorkshops', label: 'Ateliers' },
  { key: 'hasOpenStage', label: 'Scène ouverte' },
  { key: 'hasConcert', label: 'Concert' },
  { key: 'hasGala', label: 'Gala' },
  { key: 'hasLongShow', label: 'Spectacle long' },
  { key: 'hasAerialSpace', label: 'Espace aérien' },
  { key: 'hasFireSpace', label: 'Espace feu' },
  { key: 'hasSlacklineSpace', label: 'Espace slackline' },
  { key: 'hasAccessibility', label: 'Accessibilité PMR' },
  { key: 'hasCashPayment', label: 'Paiement espèces' },
  { key: 'hasCreditCardPayment', label: 'Paiement CB' },
  { key: 'hasAfjTokenPayment', label: 'Jetons AFJ' },
  { key: 'hasATM', label: 'Distributeur' },
] as const

/**
 * Schéma pour l'édition
 */
export const editionImportSchema = z
  .object({
    name: z.string().min(1).nullable().optional(),
    description: z.string().nullable().optional(),
    startDate: z.string().regex(ISO_DATE_PATTERN, 'Format de date invalide (YYYY-MM-DD ou ISO)'),
    endDate: z.string().regex(ISO_DATE_PATTERN, 'Format de date invalide (YYYY-MM-DD ou ISO)'),
    addressLine1: z.string().min(1, 'Adresse requise'),
    addressLine2: z.string().nullable().optional(),
    city: z.string().min(1, 'Ville requise'),
    region: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    country: z.string().min(1, 'Pays requis'),
    postalCode: z.string().min(1, 'Code postal requis'),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    ticketingUrl: z.string().url().or(z.literal('')).nullable().optional(),
    facebookUrl: z.string().url().or(z.literal('')).nullable().optional(),
    instagramUrl: z.string().url().or(z.literal('')).nullable().optional(),
    officialWebsiteUrl: z.string().url().or(z.literal('')).nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    // Champs bénévoles
    volunteersOpen: z.boolean().optional(),
    volunteersDescription: z.string().nullable().optional(),
    volunteersExternalUrl: z.string().url().or(z.literal('')).nullable().optional(),
  })
  .merge(editionFeaturesSchema)

/**
 * Schéma complet pour l'import
 */
export const importEditionSchema = z.object({
  convention: conventionImportSchema,
  edition: editionImportSchema,
})

/**
 * Types TypeScript dérivés des schémas
 */
export type ConventionImport = z.infer<typeof conventionImportSchema>
export type EditionImport = z.infer<typeof editionImportSchema>
export type ImportEditionData = z.infer<typeof importEditionSchema>

/**
 * Résultat de validation
 */
export interface ValidationResult {
  success: boolean
  errors: string[]
  data: ImportEditionData | null
}

/**
 * Valide les données d'import et retourne un résultat formaté
 *
 * @param input - Données à valider (objet JSON parsé)
 * @returns Résultat de validation avec erreurs formatées
 */
export function validateImportData(input: unknown): ValidationResult {
  const result = importEditionSchema.safeParse(input)

  if (result.success) {
    // Validation supplémentaire: date de fin après date de début
    const { startDate, endDate } = result.data.edition
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end < start) {
      return {
        success: false,
        errors: ['La date de fin doit être après la date de début'],
        data: null,
      }
    }

    return {
      success: true,
      errors: [],
      data: result.data,
    }
  }

  // Formater les erreurs Zod de manière lisible
  const errors = result.error.errors.map((err) => {
    const path = err.path.join('.')
    return `${path}: ${err.message}`
  })

  return {
    success: false,
    errors,
    data: null,
  }
}

/**
 * Vérifie si une chaîne est une date valide
 */
export function isValidDate(dateString: string): boolean {
  if (!ISO_DATE_PATTERN.test(dateString)) {
    return false
  }
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}
