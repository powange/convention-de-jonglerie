import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'
import {
  getAvailableMealsOnArrival,
  getAvailableMealsOnDeparture,
} from '#server/utils/volunteer-meals'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Récupérer le bénévole
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: {
      editionId_userId: {
        editionId,
        userId: user.id,
      },
    },
    select: {
      id: true,
      status: true,
      setupAvailability: true,
      teardownAvailability: true,
      eventAvailability: true,
      arrivalDateTime: true,
      departureDateTime: true,
    },
  })

  if (!volunteer) {
    throw createError({
      status: 404,
      message: "Vous n'êtes pas bénévole pour cette édition",
    })
  }

  if (volunteer.status !== 'ACCEPTED') {
    throw createError({
      status: 403,
      message: "Votre candidature n'a pas encore été acceptée",
    })
  }

  // Récupérer tous les repas activés pour l'édition
  const allMeals = await prisma.volunteerMeal.findMany({
    where: {
      editionId,
      enabled: true,
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  })

  // Filtrer les repas selon les disponibilités du bénévole
  const filteredMeals = allMeals.filter((meal) => {
    // Filtrer par phases selon les disponibilités
    // Le bénévole est éligible si AU MOINS UNE des phases correspond à ses disponibilités
    const hasSetup = meal.phases.includes('SETUP')
    const hasEvent = meal.phases.includes('EVENT')
    const hasTeardown = meal.phases.includes('TEARDOWN')

    const isEligibleForPhases =
      (hasSetup && volunteer.setupAvailability) ||
      (hasEvent && volunteer.eventAvailability) ||
      (hasTeardown && volunteer.teardownAvailability)

    if (!isEligibleForPhases) return false

    // Filtrer par dates d'arrivée et de départ si renseignées
    const mealDate = new Date(meal.date)
    mealDate.setUTCHours(0, 0, 0, 0)

    if (volunteer.arrivalDateTime) {
      // Format: YYYY-MM-DD_timeOfDay
      const [arrivalDatePart, arrivalTimeOfDay] = volunteer.arrivalDateTime.split('_')
      const arrivalDate = new Date(arrivalDatePart)
      arrivalDate.setUTCHours(0, 0, 0, 0)

      if (mealDate < arrivalDate) return false

      // Si c'est le jour d'arrivée, vérifier l'heure
      if (mealDate.getTime() === arrivalDate.getTime()) {
        const availableMeals = getAvailableMealsOnArrival(arrivalTimeOfDay)
        if (!availableMeals.includes(meal.mealType)) return false
      }
    }

    if (volunteer.departureDateTime) {
      // Format: YYYY-MM-DD_timeOfDay
      const [departureDatePart, departureTimeOfDay] = volunteer.departureDateTime.split('_')
      const departureDate = new Date(departureDatePart)
      departureDate.setUTCHours(0, 0, 0, 0)

      if (mealDate > departureDate) return false

      // Si c'est le jour de départ, vérifier l'heure
      if (mealDate.getTime() === departureDate.getTime()) {
        const availableMeals = getAvailableMealsOnDeparture(departureTimeOfDay)
        if (!availableMeals.includes(meal.mealType)) return false
      }
    }

    return true
  })

  // Récupérer les sélections existantes
  const existingSelections = await prisma.volunteerMealSelection.findMany({
    where: {
      volunteerId: volunteer.id,
      mealId: {
        in: filteredMeals.map((m) => m.id),
      },
    },
  })

  // Créer un map des sélections existantes
  const selectionsMap = new Map(existingSelections.map((s) => [s.mealId, s]))

  // Créer les sélections manquantes avec accepted=true par défaut
  const selectionsToCreate = filteredMeals
    .filter((meal) => !selectionsMap.has(meal.id))
    .map((meal) => ({
      volunteerId: volunteer.id,
      mealId: meal.id,
      accepted: true,
    }))

  if (selectionsToCreate.length > 0) {
    await prisma.volunteerMealSelection.createMany({
      data: selectionsToCreate,
    })

    // Récupérer les nouvelles sélections
    const newSelections = await prisma.volunteerMealSelection.findMany({
      where: {
        volunteerId: volunteer.id,
        mealId: {
          in: selectionsToCreate.map((s) => s.mealId),
        },
      },
    })

    // Ajouter les nouvelles sélections au map
    newSelections.forEach((s) => selectionsMap.set(s.mealId, s))
  }

  // Construire le résultat avec les repas et leurs sélections
  const mealsWithSelections = filteredMeals.map((meal) => {
    const selection = selectionsMap.get(meal.id)
    return {
      id: meal.id,
      date: meal.date,
      mealType: meal.mealType,
      phases: meal.phases,
      selectionId: selection?.id,
      accepted: selection?.accepted ?? true,
    }
  })

  return {
    success: true,
    meals: mealsWithSelections,
  }
}, 'GetMyVolunteerMeals')
