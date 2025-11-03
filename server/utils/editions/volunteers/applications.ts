import { z } from 'zod'

import { requiresEmergencyContact } from '../../../utils/allergy-severity'
import { prisma } from '../../prisma'

// Créneaux horaires valides pour les préférences
export const VALID_TIME_SLOTS = [
  'early_morning',
  'morning',
  'lunch',
  'early_afternoon',
  'late_afternoon',
  'evening',
  'late_evening',
  'night',
] as const

export const volunteerApplicationBodySchema = z.object({
  motivation: z.string().max(2000).optional().nullable(),
  phone: z
    .string()
    .min(6, 'Téléphone trop court')
    .max(30, 'Téléphone trop long')
    .regex(/^[+0-9 ().-]{6,30}$/, 'Format de téléphone invalide')
    .optional(),
  nom: z.string().min(1, 'Nom requis').max(100, 'Nom trop long').optional(),
  prenom: z.string().min(1, 'Prénom requis').max(100, 'Prénom trop long').optional(),
  dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).optional(),
  allergies: z.string().max(500).optional().nullable(),
  allergySeverity: z.enum(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']).optional().nullable(),
  timePreferences: z
    .array(z.enum(VALID_TIME_SLOTS))
    .refine((arr) => arr.every((slot) => VALID_TIME_SLOTS.includes(slot)), {
      message: 'Créneau horaire invalide',
    })
    .max(8, 'Maximum 8 créneaux horaires')
    .refine(
      (arr) => {
        // Vérifier qu'il n'y a pas de doublons
        const uniqueValues = new Set(arr)
        return uniqueValues.size === arr.length
      },
      { message: 'Les créneaux horaires ne doivent pas contenir de doublons' }
    )
    .optional(),
  teamPreferences: z.array(z.string()).max(20).optional(),
  hasPets: z.boolean().optional(),
  petsDetails: z.string().max(200).optional().nullable(),
  hasMinors: z.boolean().optional(),
  minorsDetails: z.string().max(200).optional().nullable(),
  hasVehicle: z.boolean().optional(),
  vehicleDetails: z.string().max(200).optional().nullable(),
  companionName: z.string().max(300).optional().nullable(),
  avoidList: z.string().max(500).optional().nullable(),
  skills: z.string().max(1000).optional().nullable(),
  hasExperience: z.boolean().optional(),
  experienceDetails: z.string().max(500).optional().nullable(),
  setupAvailability: z.boolean().optional(),
  teardownAvailability: z.boolean().optional(),
  eventAvailability: z.boolean().optional(),
  arrivalDateTime: z.string().optional().nullable(),
  departureDateTime: z.string().optional().nullable(),
  emergencyContactName: z.string().max(100).optional().nullable(),
  emergencyContactPhone: z
    .string()
    .min(6, 'Téléphone contact urgence trop court')
    .max(30, 'Téléphone contact urgence trop long')
    .regex(/^[+0-9 ().-]{6,30}$/, 'Format téléphone contact urgence invalide')
    .optional()
    .nullable(),
})

export type VolunteerApplicationBody = z.infer<typeof volunteerApplicationBodySchema>

// Schéma pour les mises à jour PATCH (tous les champs optionnels)
export const volunteerApplicationPatchSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'PENDING']).optional(),
  teams: z.array(z.string()).optional(),
  note: z.string().optional(),

  // Données personnelles
  phone: z
    .string()
    .min(6, 'Téléphone trop court')
    .max(30, 'Téléphone trop long')
    .regex(/^[+0-9 ().-]{6,30}$/, 'Format de téléphone invalide')
    .optional(),

  // Disponibilités
  setupAvailability: z.boolean().optional(),
  teardownAvailability: z.boolean().optional(),
  eventAvailability: z.boolean().optional(),
  arrivalDateTime: z.string().optional(),
  departureDateTime: z.string().optional(),

  // Préférences
  teamPreferences: z.array(z.string()).optional(),
  timePreferences: z.array(z.enum(VALID_TIME_SLOTS)).optional(),
  companionName: z.string().optional(),
  avoidList: z.string().optional(),

  // Régime et allergies
  dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).optional(),
  allergies: z.string().optional(),
  allergySeverity: z.enum(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),

  // Informations complémentaires
  hasPets: z.boolean().optional(),
  petsDetails: z.string().optional(),
  hasMinors: z.boolean().optional(),
  minorsDetails: z.string().optional(),
  hasVehicle: z.boolean().optional(),
  vehicleDetails: z.string().optional(),
  skills: z.string().optional(),
  hasExperience: z.boolean().optional(),
  experienceDetails: z.string().optional(),
  motivation: z.string().optional(),

  // Note de modification
  modificationNote: z.string().optional(),
})

export type VolunteerApplicationPatch = z.infer<typeof volunteerApplicationPatchSchema>

/**
 * Traite la logique du téléphone pour une candidature de bénévole
 * @param user - Utilisateur existant avec ses données
 * @param parsed - Données parsées de la candidature
 * @returns Le téléphone final à utiliser pour userSnapshotPhone
 */
export function processPhoneLogic(
  user: { phone: string | null },
  parsed: { phone?: string }
): string {
  // Utiliser le téléphone fourni dans la candidature, sinon celui du profil
  return parsed.phone || user.phone!
}

/**
 * Détermine les données à mettre à jour dans le profil utilisateur
 * @param user - Utilisateur existant
 * @param parsed - Données parsées de la candidature
 * @returns Objet contenant les champs à mettre à jour
 */
export function getUserUpdateData(
  user: { phone: string | null; nom: string | null; prenom: string | null },
  parsed: { phone?: string; nom?: string; prenom?: string }
): Record<string, any> {
  const updateData: Record<string, any> = {}

  // Mettre à jour le téléphone seulement si l'utilisateur n'en a pas
  if (!user.phone && parsed.phone) updateData.phone = parsed.phone

  // Mettre à jour nom/prénom seulement s'ils manquent
  if (!user.nom && parsed.nom) updateData.nom = parsed.nom
  if (!user.prenom && parsed.prenom) updateData.prenom = parsed.prenom

  return updateData
}

/**
 * Valide les champs requis pour une candidature de bénévole
 * @param user - Utilisateur existant
 * @param parsed - Données parsées de la candidature
 * @param edition - Configuration de l'édition
 * @returns Array des champs manqants
 */
export function validateRequiredFields(
  user: { phone: string | null; nom: string | null; prenom: string | null },
  parsed: VolunteerApplicationBody,
  edition: {
    volunteersAskAllergies: boolean
    volunteersAskEmergencyContact: boolean
  }
): string[] {
  const missing: string[] = []

  // Validation des données personnelles
  if (!user.phone && !parsed.phone) missing.push('Téléphone')
  if (!user.nom && !parsed.nom) missing.push('Nom')
  if (!user.prenom && !parsed.prenom) missing.push('Prénom')

  // Validation: si allergies renseignées, le niveau de sévérité est requis
  if (edition.volunteersAskAllergies && parsed.allergies?.trim() && !parsed.allergySeverity) {
    missing.push('Niveau de sévérité des allergies')
  }

  // Déterminer si le contact d'urgence est requis
  const shouldRequireEmergencyContact =
    edition.volunteersAskEmergencyContact ||
    (parsed.allergySeverity && requiresEmergencyContact(parsed.allergySeverity))

  // Validation contact d'urgence si demandé explicitement ou si allergies renseignées
  if (shouldRequireEmergencyContact) {
    if (!parsed.emergencyContactName?.trim()) missing.push("Nom du contact d'urgence")
    if (!parsed.emergencyContactPhone?.trim()) missing.push("Téléphone du contact d'urgence")
  }

  return missing
}

/**
 * Valide les disponibilités d'une candidature
 * @param parsed - Données parsées de la candidature
 * @returns Array des erreurs de validation
 */
export function validateAvailability(parsed: VolunteerApplicationBody): string[] {
  const errors: string[] = []

  // Au moins une disponibilité requise
  const hasAvailability =
    parsed.setupAvailability || parsed.teardownAvailability || parsed.eventAvailability
  if (!hasAvailability) {
    errors.push('Au moins une disponibilité est requise')
  }

  // Validation des dates d'arrivée/départ si disponibilité sélectionnée
  if (
    (parsed.setupAvailability || parsed.eventAvailability || parsed.teardownAvailability) &&
    !parsed.arrivalDateTime
  ) {
    errors.push("Date d'arrivée requise")
  }

  if ((parsed.eventAvailability || parsed.teardownAvailability) && !parsed.departureDateTime) {
    errors.push('Date de départ requise')
  }

  return errors
}

/**
 * Valide les préférences d'équipes
 * @param parsed - Données parsées de la candidature
 * @param editionId - ID de l'édition
 * @param volunteersAskTeamPreferences - Si l'édition demande les préférences d'équipes
 * @returns Promise<string[]> Array des erreurs de validation
 */
export async function validateTeamPreferences(
  parsed: VolunteerApplicationBody,
  editionId: number,
  volunteersAskTeamPreferences: boolean
): Promise<string[]> {
  const errors: string[] = []

  if (volunteersAskTeamPreferences && parsed.teamPreferences && parsed.teamPreferences.length > 0) {
    // Récupérer les équipes du nouveau système
    const validTeams = await prisma.volunteerTeam.findMany({
      where: { editionId },
      select: { id: true, name: true },
    })

    const validTeamIds = validTeams.map((team) => team.id)
    const validTeamNames = validTeams.map((team) => team.name)

    // Vérifier si les IDs fournis sont valides
    const invalidTeams = parsed.teamPreferences.filter((teamId) => !validTeamIds.includes(teamId))
    if (invalidTeams.length > 0) {
      errors.push(
        `Équipes invalides : ${invalidTeams.join(', ')}. Équipes valides : ${validTeamNames.join(', ')}`
      )
    }
  }

  return errors
}

/**
 * Valide la logique des allergies pour une mise à jour PATCH
 * @param parsed - Données parsées de la mise à jour
 * @returns Array des erreurs de validation
 */
export function validateAllergiesUpdate(parsed: VolunteerApplicationPatch): string[] {
  const errors: string[] = []

  // Validation: si allergies renseignées, le niveau de sévérité est requis
  if (parsed.allergies?.trim() && !parsed.allergySeverity) {
    errors.push('Niveau de sévérité des allergies requis')
  }

  return errors
}

/**
 * Construit l'objet de mise à jour pour une candidature PATCH
 * @param parsed - Données parsées de la mise à jour
 * @param user - Données utilisateur (optionnel, pour la gestion du téléphone)
 * @returns Objet de mise à jour pour Prisma
 */
export function buildVolunteerApplicationUpdateData(
  parsed: VolunteerApplicationPatch,
  user?: { phone: string | null }
): Record<string, any> {
  const updateData: any = {}

  // Données personnelles - téléphone
  if (parsed.phone !== undefined && user) {
    updateData.userSnapshotPhone = processPhoneLogic(user, parsed)
  }

  // Disponibilités
  if (parsed.setupAvailability !== undefined)
    updateData.setupAvailability = parsed.setupAvailability
  if (parsed.teardownAvailability !== undefined)
    updateData.teardownAvailability = parsed.teardownAvailability
  if (parsed.eventAvailability !== undefined)
    updateData.eventAvailability = parsed.eventAvailability
  if (parsed.arrivalDateTime !== undefined)
    updateData.arrivalDateTime = parsed.arrivalDateTime || null
  if (parsed.departureDateTime !== undefined)
    updateData.departureDateTime = parsed.departureDateTime || null

  // Préférences
  if (parsed.teamPreferences !== undefined) updateData.teamPreferences = parsed.teamPreferences
  if (parsed.timePreferences !== undefined) updateData.timePreferences = parsed.timePreferences
  if (parsed.companionName !== undefined)
    updateData.companionName = parsed.companionName?.trim() || null
  if (parsed.avoidList !== undefined) updateData.avoidList = parsed.avoidList?.trim() || null

  // Régime et allergies
  if (parsed.dietaryPreference !== undefined)
    updateData.dietaryPreference = parsed.dietaryPreference
  if (parsed.allergies !== undefined) updateData.allergies = parsed.allergies?.trim() || null
  if (parsed.allergySeverity !== undefined) {
    updateData.allergySeverity = parsed.allergies?.trim() ? parsed.allergySeverity : null
  }
  if (parsed.emergencyContactName !== undefined) {
    updateData.emergencyContactName = parsed.emergencyContactName?.trim() || null
  }
  if (parsed.emergencyContactPhone !== undefined) {
    updateData.emergencyContactPhone = parsed.emergencyContactPhone?.trim() || null
  }

  // Informations complémentaires
  if (parsed.hasPets !== undefined) updateData.hasPets = parsed.hasPets
  if (parsed.petsDetails !== undefined) updateData.petsDetails = parsed.petsDetails?.trim() || null
  if (parsed.hasMinors !== undefined) updateData.hasMinors = parsed.hasMinors
  if (parsed.minorsDetails !== undefined)
    updateData.minorsDetails = parsed.minorsDetails?.trim() || null
  if (parsed.hasVehicle !== undefined) updateData.hasVehicle = parsed.hasVehicle
  if (parsed.vehicleDetails !== undefined)
    updateData.vehicleDetails = parsed.vehicleDetails?.trim() || null
  if (parsed.skills !== undefined) updateData.skills = parsed.skills?.trim() || null
  if (parsed.hasExperience !== undefined) updateData.hasExperience = parsed.hasExperience
  if (parsed.experienceDetails !== undefined) {
    updateData.experienceDetails = parsed.experienceDetails?.trim() || null
  }
  if (parsed.motivation !== undefined) updateData.motivation = parsed.motivation?.trim() || null

  return updateData
}
