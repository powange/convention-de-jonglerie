import type { AllergySeverityLevel } from './allergy-severity'

/**
 * Interface pour les données d'une candidature de bénévole
 */
export interface VolunteerApplicationData {
  // Données personnelles
  phone?: string
  firstName?: string
  lastName?: string

  // Disponibilités
  setupAvailability?: boolean
  teardownAvailability?: boolean
  eventAvailability?: boolean
  arrivalDateTime?: string
  departureDateTime?: string

  // Préférences d'équipes et créneaux
  teamPreferences?: string[]
  timePreferences?: string[]

  // Préférences de covoiturage
  companionName?: string
  avoidList?: string

  // Régime et allergies
  dietaryPreference?: 'NONE' | 'VEGETARIAN' | 'VEGAN'
  allergies?: string
  allergySeverity?: AllergySeverityLevel
  emergencyContactName?: string
  emergencyContactPhone?: string

  // Informations complémentaires
  hasPets?: boolean
  petsDetails?: string
  hasMinors?: boolean
  minorsDetails?: string
  hasVehicle?: boolean
  vehicleDetails?: string
  skills?: string
  hasExperience?: boolean
  experienceDetails?: string
  motivation?: string

  // Note de modification (pour les organisateurs)
  modificationNote?: string
}

/**
 * Interface pour les données de mise à jour d'une candidature avec l'ID
 */
export interface VolunteerApplicationUpdateData extends VolunteerApplicationData {
  applicationId: number
}

/**
 * Met à jour une candidature de bénévole via l'API
 */
export async function updateVolunteerApplication(
  editionId: number,
  data: VolunteerApplicationUpdateData
): Promise<any> {
  const { applicationId, ...applicationData } = data

  return await $fetch(`/api/editions/${editionId}/volunteers/applications/${applicationId}`, {
    method: 'PATCH',
    body: {
      // Données personnelles
      phone: applicationData.phone,

      // Préférences d'équipes et créneaux
      teamPreferences: applicationData.teamPreferences,
      timePreferences: applicationData.timePreferences,

      // Disponibilités
      setupAvailability: applicationData.setupAvailability,
      eventAvailability: applicationData.eventAvailability,
      teardownAvailability: applicationData.teardownAvailability,
      arrivalDateTime: applicationData.arrivalDateTime,
      departureDateTime: applicationData.departureDateTime,

      // Préférences de covoiturage
      companionName: applicationData.companionName,
      avoidList: applicationData.avoidList,

      // Régime et allergies
      dietaryPreference: applicationData.dietaryPreference,
      allergies: applicationData.allergies,
      allergySeverity: applicationData.allergySeverity,
      emergencyContactName: applicationData.emergencyContactName,
      emergencyContactPhone: applicationData.emergencyContactPhone,

      // Informations complémentaires
      hasPets: applicationData.hasPets,
      petsDetails: applicationData.petsDetails,
      hasMinors: applicationData.hasMinors,
      minorsDetails: applicationData.minorsDetails,
      hasVehicle: applicationData.hasVehicle,
      vehicleDetails: applicationData.vehicleDetails,
      skills: applicationData.skills,
      hasExperience: applicationData.hasExperience,
      experienceDetails: applicationData.experienceDetails,
      motivation: applicationData.motivation,

      // Note de modification
      modificationNote: applicationData.modificationNote,
    },
  })
}

/**
 * Change le statut d'une candidature de bénévole
 */
export async function updateVolunteerApplicationStatus(
  editionId: number,
  applicationId: number,
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING',
  options?: {
    teams?: string[]
    note?: string
  }
): Promise<any> {
  return await $fetch(`/api/editions/${editionId}/volunteers/applications/${applicationId}`, {
    method: 'PATCH',
    body: {
      status,
      ...(options?.teams && { teams: options.teams }),
      ...(options?.note && { note: options.note }),
    },
  })
}

/**
 * Assigne des équipes à une candidature de bénévole
 */
export async function assignVolunteerTeams(
  editionId: number,
  applicationId: number,
  teams: string[]
): Promise<any> {
  return await $fetch(`/api/editions/${editionId}/volunteers/applications/${applicationId}/teams`, {
    method: 'PATCH',
    body: {
      teams,
    },
  })
}

/**
 * Soumet une nouvelle candidature de bénévole via l'API
 */
export async function submitVolunteerApplication(
  editionId: number,
  data: VolunteerApplicationData
): Promise<any> {
  return await $fetch(`/api/editions/${editionId}/volunteers/applications`, {
    method: 'POST',
    body: {
      // Données personnelles (noms différents dans l'API POST)
      phone: data.phone,
      nom: data.lastName,
      prenom: data.firstName,

      // Préférences d'équipes et créneaux
      teamPreferences: data.teamPreferences,
      timePreferences: data.timePreferences,

      // Disponibilités
      setupAvailability: data.setupAvailability,
      eventAvailability: data.eventAvailability,
      teardownAvailability: data.teardownAvailability,
      arrivalDateTime: data.arrivalDateTime,
      departureDateTime: data.departureDateTime,

      // Préférences de covoiturage
      companionName: data.companionName,
      avoidList: data.avoidList,

      // Régime et allergies
      dietaryPreference: data.dietaryPreference,
      allergies: data.allergies,
      allergySeverity: data.allergySeverity,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,

      // Informations complémentaires
      hasPets: data.hasPets,
      petsDetails: data.petsDetails,
      hasMinors: data.hasMinors,
      minorsDetails: data.minorsDetails,
      hasVehicle: data.hasVehicle,
      vehicleDetails: data.vehicleDetails,
      skills: data.skills,
      hasExperience: data.hasExperience,
      experienceDetails: data.experienceDetails,
      motivation: data.motivation,
    },
  })
}

/**
 * Retire une candidature de bénévole
 */
export async function withdrawVolunteerApplication(editionId: number): Promise<any> {
  return await $fetch(`/api/editions/${editionId}/volunteers/applications`, {
    method: 'DELETE',
  })
}
