import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { isVolunteerEligibleForMeal } from '@@/server/utils/volunteer-meals'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const volunteerId = parseInt(getRouterParam(event, 'volunteerId') || '0')

  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })
  if (!volunteerId) throw createError({ statusCode: 400, message: 'Bénévole invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })

  try {
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
        statusCode: 404,
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

      // Vérifier si le bénévole est éligible pour ce repas
      const eligible = isVolunteerEligibleForMeal(
        {
          date: meal.date,
          mealType: meal.mealType,
          phase: meal.phase,
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
        phase: meal.phase,
        selectionId: selection?.id || null,
        accepted: selection?.accepted || false,
        eligible,
      }
    })

    return {
      success: true,
      meals: formattedMeals,
    }
  } catch (error: unknown) {
    console.error('Failed to fetch volunteer meals:', error)

    // Si c'est déjà une erreur HTTP, la relancer
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des repas du bénévole',
    })
  }
})
