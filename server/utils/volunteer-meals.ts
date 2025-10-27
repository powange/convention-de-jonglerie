import { prisma } from './prisma'

/**
 * Crée automatiquement les sélections de repas pour un bénévole accepté
 * Filtre selon ses disponibilités (setup/event/teardown) et ses dates d'arrivée/départ
 */
export async function createVolunteerMealSelections(
  volunteerId: number,
  editionId: number
): Promise<void> {
  // Récupérer le bénévole avec ses disponibilités
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: { id: volunteerId },
    select: {
      id: true,
      setupAvailability: true,
      teardownAvailability: true,
      eventAvailability: true,
      arrivalDateTime: true,
      departureDateTime: true,
    },
  })

  if (!volunteer) {
    throw new Error('Bénévole introuvable')
  }

  // Récupérer tous les repas activés pour l'édition
  const allMeals = await prisma.volunteerMeal.findMany({
    where: {
      editionId,
      enabled: true,
    },
  })

  // Filtrer les repas selon les disponibilités du bénévole
  const eligibleMeals = allMeals.filter((meal) => {
    // Filtrer par phase selon les disponibilités
    if (meal.phase === 'SETUP' && !volunteer.setupAvailability) return false
    if (meal.phase === 'TEARDOWN' && !volunteer.teardownAvailability) return false
    if (meal.phase === 'EVENT' && !volunteer.eventAvailability) return false

    // Filtrer par dates d'arrivée et de départ si renseignées
    const mealDate = new Date(meal.date)
    mealDate.setUTCHours(0, 0, 0, 0)

    if (volunteer.arrivalDateTime) {
      // Format: YYYY-MM-DD_timeOfDay
      const arrivalDatePart = volunteer.arrivalDateTime.split('_')[0]
      const arrivalDate = new Date(arrivalDatePart)
      arrivalDate.setUTCHours(0, 0, 0, 0)
      if (mealDate < arrivalDate) return false
    }

    if (volunteer.departureDateTime) {
      // Format: YYYY-MM-DD_timeOfDay
      const departureDatePart = volunteer.departureDateTime.split('_')[0]
      const departureDate = new Date(departureDatePart)
      departureDate.setUTCHours(0, 0, 0, 0)
      if (mealDate > departureDate) return false
    }

    return true
  })

  // Vérifier quelles sélections existent déjà
  const existingSelections = await prisma.volunteerMealSelection.findMany({
    where: {
      volunteerId: volunteer.id,
      mealId: {
        in: eligibleMeals.map((m) => m.id),
      },
    },
  })

  const existingMealIds = new Set(existingSelections.map((s) => s.mealId))

  // Créer les sélections manquantes avec accepted=true par défaut
  const selectionsToCreate = eligibleMeals
    .filter((meal) => !existingMealIds.has(meal.id))
    .map((meal) => ({
      volunteerId: volunteer.id,
      mealId: meal.id,
      accepted: true,
    }))

  if (selectionsToCreate.length > 0) {
    await prisma.volunteerMealSelection.createMany({
      data: selectionsToCreate,
    })
  }
}

/**
 * Supprime toutes les sélections de repas d'un bénévole
 */
export async function deleteVolunteerMealSelections(volunteerId: number): Promise<void> {
  await prisma.volunteerMealSelection.deleteMany({
    where: {
      volunteerId,
    },
  })
}
