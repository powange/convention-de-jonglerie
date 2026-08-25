/**
 * Utilitaire pour comparer les modifications des candidatures de bénévoles
 */

export interface ApplicationData {
  [key: string]: any // Flexible pour accepter les données Prisma
}

export interface UpdatedApplicationData {
  // Données personnelles
  phone?: string

  // Portés par le corps de la requête, écrits sur le PROFIL et non sur la candidature.
  dietaryPreference?: 'NONE' | 'VEGETARIAN' | 'VEGAN'
  allergies?: string
  allergySeverity?: 'LIGHT' | 'MODERATE' | 'SEVERE' | 'CRITICAL'
  emergencyContactName?: string
  emergencyContactPhone?: string

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

  // Comparer le téléphone
  if (
    updatedData.phone !== undefined &&
    (updatedData.phone || '').trim() !== (originalData.userSnapshotPhone || '').trim()
  ) {
    const oldPhone = originalData.userSnapshotPhone?.trim() || 'Non renseigné'
    const newPhone = updatedData.phone?.trim() || 'Non renseigné'
    changes.push(`Téléphone modifié : ${oldPhone} → ${newPhone}`)
  }

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

  // Régime, allergies et gravité ne sont plus comparés ici : ils ne vivent plus sur la
  // candidature mais sur le profil, qui n'appartient pas à l'édition. Annoncer à un bénévole
  // qu'un organisateur a « modifié son régime » n'aurait plus de sens — l'organisateur ne peut
  // plus écraser ce que la personne a mis dans son profil.

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

  // Le contact d'urgence n'est plus comparé ici : il vit sur le profil, pas sur la candidature.

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
    // Données personnelles
    updatedData.phone !== undefined ||
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
    // Régime, allergies et contact d'urgence : ces champs ne sont plus stockés sur la
    // candidature, mais ils arrivent toujours dans le corps de la requête — ils vont au profil.
    // Les retirer d'ici ferait tomber une requête qui ne porte qu'eux dans la branche
    // « changement de statut », qui la rejetterait faute de statut.
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
