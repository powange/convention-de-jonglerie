/**
 * Utilitaire pour comparer les modifications des candidatures de bénévoles
 */

import { prisma } from './prisma'

export interface ApplicationData {
  [key: string]: any // Flexible pour accepter les données Prisma
}

export interface UpdatedApplicationData {
  // Disponibilités
  setupAvailability?: boolean
  teardownAvailability?: boolean
  eventAvailability?: boolean
  arrivalDateTime?: string
  departureDateTime?: string

  // Préférences
  teamPreferences?: string[]
  timePreferences?: string[]
  companionName?: string
  avoidList?: string

  // Régime et allergies
  dietaryPreference?: 'NONE' | 'VEGETARIAN' | 'VEGAN'
  allergies?: string
  allergySeverity?: 'LIGHT' | 'MODERATE' | 'SEVERE' | 'CRITICAL'
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
}

export interface ApplicationChanges {
  changes: string[]
  hasChanges: boolean
}

/**
 * Compare les données avant/après pour détecter les modifications d'une candidature
 */
export async function compareApplicationChanges(
  originalData: ApplicationData,
  updatedData: UpdatedApplicationData
): Promise<ApplicationChanges> {
  const changes: string[] = []

  // Comparer les préférences d'équipes
  if (updatedData.teamPreferences !== undefined) {
    const oldTeamPrefs = (originalData.teamPreferences as string[]) || []
    const newTeamPrefs = updatedData.teamPreferences || []

    if (JSON.stringify(oldTeamPrefs.sort()) !== JSON.stringify(newTeamPrefs.sort())) {
      // Récupérer les noms des équipes pour un affichage lisible
      const allTeamIds = [...new Set([...oldTeamPrefs, ...newTeamPrefs])]
      const teams = await prisma.volunteerTeam.findMany({
        where: { id: { in: allTeamIds } },
        select: { id: true, name: true },
      })

      // Créer un map ID -> Nom pour faciliter la conversion
      const teamMap = new Map(teams.map((t) => [t.id, t.name]))

      // Convertir les IDs en noms
      const oldTeamNames = oldTeamPrefs.map((id) => teamMap.get(id) || 'Équipe inconnue')
      const newTeamNames = newTeamPrefs.map((id) => teamMap.get(id) || 'Équipe inconnue')

      if (oldTeamPrefs.length === 0 && newTeamPrefs.length > 0) {
        changes.push(`Équipes préférées ajoutées : ${newTeamNames.join(', ')}`)
      } else if (oldTeamPrefs.length > 0 && newTeamPrefs.length === 0) {
        changes.push(`Équipes préférées supprimées : ${oldTeamNames.join(', ')}`)
      } else {
        const added = newTeamPrefs.filter((team) => !oldTeamPrefs.includes(team))
        const removed = oldTeamPrefs.filter((team) => !newTeamPrefs.includes(team))

        if (added.length > 0) {
          const addedNames = added.map((id) => teamMap.get(id) || 'Équipe inconnue')
          changes.push(`Équipes préférées ajoutées : ${addedNames.join(', ')}`)
        }
        if (removed.length > 0) {
          const removedNames = removed.map((id) => teamMap.get(id) || 'Équipe inconnue')
          changes.push(`Équipes préférées supprimées : ${removedNames.join(', ')}`)
        }
      }
    }
  }

  // Comparer le régime alimentaire
  if (
    updatedData.dietaryPreference !== undefined &&
    updatedData.dietaryPreference !== originalData.dietaryPreference
  ) {
    const dietLabels = {
      NONE: 'Aucun régime spécial',
      VEGETARIAN: 'Végétarien',
      VEGAN: 'Végétalien',
    }
    const oldDiet =
      dietLabels[originalData.dietaryPreference as keyof typeof dietLabels] ||
      originalData.dietaryPreference
    const newDiet =
      dietLabels[updatedData.dietaryPreference as keyof typeof dietLabels] ||
      updatedData.dietaryPreference
    changes.push(`Régime alimentaire modifié : ${oldDiet} → ${newDiet}`)
  }

  // Comparer les allergies
  if (
    updatedData.allergies !== undefined &&
    (updatedData.allergies || '').trim() !== (originalData.allergies || '').trim()
  ) {
    const oldAllergies = originalData.allergies?.trim() || ''
    const newAllergies = updatedData.allergies?.trim() || ''

    if (oldAllergies && newAllergies) {
      changes.push(`Allergies modifiées : "${oldAllergies}" → "${newAllergies}"`)
    } else if (newAllergies) {
      changes.push(`Allergies ajoutées : "${newAllergies}"`)
    } else {
      changes.push(`Allergies supprimées : "${oldAllergies}"`)
    }
  }

  // Comparer la sévérité des allergies
  if (
    updatedData.allergySeverity !== undefined &&
    updatedData.allergySeverity !== originalData.allergySeverity
  ) {
    const severityLabels = {
      LIGHT: 'Légère',
      MODERATE: 'Modérée',
      SEVERE: 'Sévère',
      CRITICAL: 'Critique',
    }
    const oldSeverity = originalData.allergySeverity
      ? severityLabels[originalData.allergySeverity as keyof typeof severityLabels]
      : 'Non spécifiée'
    const newSeverity = updatedData.allergySeverity
      ? severityLabels[updatedData.allergySeverity as keyof typeof severityLabels]
      : 'Non spécifiée'
    changes.push(`Sévérité des allergies modifiée : ${oldSeverity} → ${newSeverity}`)
  }

  // Comparer les disponibilités
  if (
    updatedData.setupAvailability !== undefined &&
    updatedData.setupAvailability !== originalData.setupAvailability
  ) {
    const label = updatedData.setupAvailability ? 'disponible' : 'non disponible'
    changes.push(`Disponibilité pour le montage : ${label}`)
  }

  if (
    updatedData.teardownAvailability !== undefined &&
    updatedData.teardownAvailability !== originalData.teardownAvailability
  ) {
    const label = updatedData.teardownAvailability ? 'disponible' : 'non disponible'
    changes.push(`Disponibilité pour le démontage : ${label}`)
  }

  if (
    updatedData.eventAvailability !== undefined &&
    updatedData.eventAvailability !== originalData.eventAvailability
  ) {
    const label = updatedData.eventAvailability ? 'disponible' : 'non disponible'
    changes.push(`Disponibilité pendant l'événement : ${label}`)
  }

  if (
    updatedData.arrivalDateTime !== undefined &&
    updatedData.arrivalDateTime !== originalData.arrivalDateTime
  ) {
    const oldDate = originalData.arrivalDateTime
      ? new Date(originalData.arrivalDateTime).toLocaleString('fr-FR')
      : 'Non renseigné'
    const newDate = updatedData.arrivalDateTime
      ? new Date(updatedData.arrivalDateTime).toLocaleString('fr-FR')
      : 'Non renseigné'
    changes.push(`Date d'arrivée modifiée : ${oldDate} → ${newDate}`)
  }

  if (
    updatedData.departureDateTime !== undefined &&
    updatedData.departureDateTime !== originalData.departureDateTime
  ) {
    const oldDate = originalData.departureDateTime
      ? new Date(originalData.departureDateTime).toLocaleString('fr-FR')
      : 'Non renseigné'
    const newDate = updatedData.departureDateTime
      ? new Date(updatedData.departureDateTime).toLocaleString('fr-FR')
      : 'Non renseigné'
    changes.push(`Date de départ modifiée : ${oldDate} → ${newDate}`)
  }

  // Comparer les préférences de créneaux
  if (updatedData.timePreferences !== undefined) {
    const oldTimePrefs = (originalData.timePreferences as string[]) || []
    const newTimePrefs = updatedData.timePreferences || []

    if (JSON.stringify(oldTimePrefs.sort()) !== JSON.stringify(newTimePrefs.sort())) {
      const timeSlotLabels: Record<string, string> = {
        early_morning: 'Tôt le matin',
        morning: 'Matin',
        lunch: 'Midi',
        early_afternoon: "Début d'après-midi",
        late_afternoon: "Fin d'après-midi",
        evening: 'Soirée',
        late_evening: 'Fin de soirée',
        night: 'Nuit',
      }

      const oldTimeNames = oldTimePrefs.map((id) => timeSlotLabels[id] || id)
      const newTimeNames = newTimePrefs.map((id) => timeSlotLabels[id] || id)

      if (oldTimePrefs.length === 0 && newTimePrefs.length > 0) {
        changes.push(`Créneaux horaires préférés ajoutés : ${newTimeNames.join(', ')}`)
      } else if (oldTimePrefs.length > 0 && newTimePrefs.length === 0) {
        changes.push(`Créneaux horaires préférés supprimés : ${oldTimeNames.join(', ')}`)
      } else {
        const added = newTimePrefs.filter((slot) => !oldTimePrefs.includes(slot))
        const removed = oldTimePrefs.filter((slot) => !newTimePrefs.includes(slot))

        if (added.length > 0) {
          const addedNames = added.map((id) => timeSlotLabels[id] || id)
          changes.push(`Créneaux horaires ajoutés : ${addedNames.join(', ')}`)
        }
        if (removed.length > 0) {
          const removedNames = removed.map((id) => timeSlotLabels[id] || id)
          changes.push(`Créneaux horaires supprimés : ${removedNames.join(', ')}`)
        }
      }
    }
  }

  // Comparer les autres préférences
  if (
    updatedData.companionName !== undefined &&
    (updatedData.companionName || '').trim() !== (originalData.companionName || '').trim()
  ) {
    const oldCompanion = originalData.companionName?.trim() || 'Aucun'
    const newCompanion = updatedData.companionName?.trim() || 'Aucun'
    changes.push(`Nom du/de la partenaire modifié : ${oldCompanion} → ${newCompanion}`)
  }

  if (
    updatedData.avoidList !== undefined &&
    (updatedData.avoidList || '').trim() !== (originalData.avoidList || '').trim()
  ) {
    const oldAvoid = originalData.avoidList?.trim() || 'Aucune'
    const newAvoid = updatedData.avoidList?.trim() || 'Aucune'
    changes.push(`Liste d'évitement modifiée : ${oldAvoid} → ${newAvoid}`)
  }

  // Comparer les contacts d'urgence
  if (
    updatedData.emergencyContactName !== undefined &&
    (updatedData.emergencyContactName || '').trim() !==
      (originalData.emergencyContactName || '').trim()
  ) {
    const oldContact = originalData.emergencyContactName?.trim() || 'Non renseigné'
    const newContact = updatedData.emergencyContactName?.trim() || 'Non renseigné'
    changes.push(`Nom du contact d'urgence modifié : ${oldContact} → ${newContact}`)
  }

  if (
    updatedData.emergencyContactPhone !== undefined &&
    (updatedData.emergencyContactPhone || '').trim() !==
      (originalData.emergencyContactPhone || '').trim()
  ) {
    const oldPhone = originalData.emergencyContactPhone?.trim() || 'Non renseigné'
    const newPhone = updatedData.emergencyContactPhone?.trim() || 'Non renseigné'
    changes.push(`Téléphone du contact d'urgence modifié : ${oldPhone} → ${newPhone}`)
  }

  // Comparer les informations complémentaires
  if (updatedData.hasPets !== undefined && updatedData.hasPets !== originalData.hasPets) {
    const label = updatedData.hasPets ? 'Oui' : 'Non'
    changes.push(`Animaux de compagnie : ${label}`)
  }

  if (
    updatedData.petsDetails !== undefined &&
    (updatedData.petsDetails || '').trim() !== (originalData.petsDetails || '').trim()
  ) {
    const oldDetails = originalData.petsDetails?.trim() || 'Aucun détail'
    const newDetails = updatedData.petsDetails?.trim() || 'Aucun détail'
    changes.push(`Détails des animaux modifiés : ${oldDetails} → ${newDetails}`)
  }

  if (updatedData.hasMinors !== undefined && updatedData.hasMinors !== originalData.hasMinors) {
    const label = updatedData.hasMinors ? 'Oui' : 'Non'
    changes.push(`Enfants mineurs : ${label}`)
  }

  if (
    updatedData.minorsDetails !== undefined &&
    (updatedData.minorsDetails || '').trim() !== (originalData.minorsDetails || '').trim()
  ) {
    const oldDetails = originalData.minorsDetails?.trim() || 'Aucun détail'
    const newDetails = updatedData.minorsDetails?.trim() || 'Aucun détail'
    changes.push(`Détails des enfants modifiés : ${oldDetails} → ${newDetails}`)
  }

  if (updatedData.hasVehicle !== undefined && updatedData.hasVehicle !== originalData.hasVehicle) {
    const label = updatedData.hasVehicle ? 'Oui' : 'Non'
    changes.push(`Véhicule disponible : ${label}`)
  }

  if (
    updatedData.vehicleDetails !== undefined &&
    (updatedData.vehicleDetails || '').trim() !== (originalData.vehicleDetails || '').trim()
  ) {
    const oldDetails = originalData.vehicleDetails?.trim() || 'Aucun détail'
    const newDetails = updatedData.vehicleDetails?.trim() || 'Aucun détail'
    changes.push(`Détails du véhicule modifiés : ${oldDetails} → ${newDetails}`)
  }

  if (
    updatedData.skills !== undefined &&
    (updatedData.skills || '').trim() !== (originalData.skills || '').trim()
  ) {
    const oldSkills = originalData.skills?.trim() || 'Aucune compétence renseignée'
    const newSkills = updatedData.skills?.trim() || 'Aucune compétence renseignée'
    changes.push(`Compétences modifiées : ${oldSkills} → ${newSkills}`)
  }

  if (
    updatedData.hasExperience !== undefined &&
    updatedData.hasExperience !== originalData.hasExperience
  ) {
    const label = updatedData.hasExperience ? 'Oui' : 'Non'
    changes.push(`Expérience en bénévolat : ${label}`)
  }

  if (
    updatedData.experienceDetails !== undefined &&
    (updatedData.experienceDetails || '').trim() !== (originalData.experienceDetails || '').trim()
  ) {
    const oldExp = originalData.experienceDetails?.trim() || 'Aucun détail'
    const newExp = updatedData.experienceDetails?.trim() || 'Aucun détail'
    changes.push(`Détails de l'expérience modifiés : ${oldExp} → ${newExp}`)
  }

  if (
    updatedData.motivation !== undefined &&
    (updatedData.motivation || '').trim() !== (originalData.motivation || '').trim()
  ) {
    const oldMotivation = originalData.motivation?.trim() || 'Aucune motivation renseignée'
    const newMotivation = updatedData.motivation?.trim() || 'Aucune motivation renseignée'
    changes.push(`Motivation modifiée : ${oldMotivation} → ${newMotivation}`)
  }

  return {
    changes,
    hasChanges: changes.length > 0,
  }
}

/**
 * Vérifie si des données de candidature ont été modifiées
 */
export function hasApplicationDataChanges(updatedData: UpdatedApplicationData): boolean {
  return (
    // Disponibilités
    updatedData.setupAvailability !== undefined ||
    updatedData.teardownAvailability !== undefined ||
    updatedData.eventAvailability !== undefined ||
    updatedData.arrivalDateTime !== undefined ||
    updatedData.departureDateTime !== undefined ||
    // Préférences
    updatedData.teamPreferences !== undefined ||
    updatedData.timePreferences !== undefined ||
    updatedData.companionName !== undefined ||
    updatedData.avoidList !== undefined ||
    // Régime et allergies
    updatedData.dietaryPreference !== undefined ||
    updatedData.allergies !== undefined ||
    updatedData.allergySeverity !== undefined ||
    updatedData.emergencyContactName !== undefined ||
    updatedData.emergencyContactPhone !== undefined ||
    // Informations complémentaires
    updatedData.hasPets !== undefined ||
    updatedData.petsDetails !== undefined ||
    updatedData.hasMinors !== undefined ||
    updatedData.minorsDetails !== undefined ||
    updatedData.hasVehicle !== undefined ||
    updatedData.vehicleDetails !== undefined ||
    updatedData.skills !== undefined ||
    updatedData.hasExperience !== undefined ||
    updatedData.experienceDetails !== undefined ||
    updatedData.motivation !== undefined
  )
}
