import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { isVolunteerEligibleForMeal } from '#server/utils/volunteer-meals'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  const volunteerId = validateResourceId(event, 'volunteerId')

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      status: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })

  // Récupérer les informations du bénévole avec ses disponibilités et dates
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: { id: volunteerId },
    select: {
      editionId: true,
      setupAvailability: true,
      eventAvailability: true,
      teardownAvailability: true,
      arrivalDateTime: true,
      departureDateTime: true,
    },
  })

  if (!volunteer || volunteer.editionId !== editionId) {
    throw createError({
      status: 404,
      message: 'Bénévole non trouvé pour cette édition',
    })
  }

  // Récupérer les repas activés pour l'édition
  const meals = await prisma.volunteerMeal.findMany({
    where: {
      editionId,
      enabled: true,
    },
    include: {
      mealSelections: {
        where: {
          volunteerId,
        },
      },
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  })

  console.log(
    `[VolunteerMeals] Édition ${editionId}, Bénévole ${volunteerId}: ${meals.length} repas trouvés`
  )

  // Formater les repas avec les sélections du bénévole et vérifier l'éligibilité
  const formattedMeals = meals.map((meal) => {
    const selection = meal.mealSelections[0] // Il ne peut y avoir qu'une sélection par bénévole

    // S'assurer que phases est un tableau de strings
    const phases = Array.isArray(meal.phases) ? (meal.phases as string[]) : []

    // Vérifier si le bénévole est éligible pour ce repas
    const eligible = isVolunteerEligibleForMeal(
      {
        date: meal.date,
        mealType: meal.mealType,
        phases,
      },
      {
        setupAvailability: volunteer.setupAvailability,
        eventAvailability: volunteer.eventAvailability,
        teardownAvailability: volunteer.teardownAvailability,
        arrivalDateTime: volunteer.arrivalDateTime,
        departureDateTime: volunteer.departureDateTime,
      }
    )

    return {
      id: meal.id,
      date: meal.date,
      mealType: meal.mealType,
      phases,
      selectionId: selection?.id || null,
      accepted: selection?.accepted || false,
      eligible,
    }
  })

  return createSuccessResponse({ meals: formattedMeals })
}, 'GetVolunteerMealsByVolunteerId')
