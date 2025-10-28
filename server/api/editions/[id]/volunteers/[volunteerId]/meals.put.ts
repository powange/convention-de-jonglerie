import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

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
      message: 'Droits insuffisants pour modifier ces données',
    })

  const body = await readBody(event)

  if (!body.selections || !Array.isArray(body.selections)) {
    throw createError({
      statusCode: 400,
      message: 'Sélections de repas invalides',
    })
  }

  try {
    // Vérifier que le bénévole appartient à cette édition
    const volunteer = await prisma.editionVolunteerApplication.findUnique({
      where: { id: volunteerId },
      select: { editionId: true },
    })

    if (!volunteer || volunteer.editionId !== editionId) {
      throw createError({
        statusCode: 404,
        message: 'Bénévole non trouvé pour cette édition',
      })
    }

    // Mettre à jour ou créer les sélections de repas
    const updatePromises = body.selections.map(async (selection: any) => {
      if (!selection.mealId) {
        return
      }

      if (!selection.selectionId) {
        // Si pas de selectionId, créer une nouvelle sélection
        return prisma.volunteerMealSelection.create({
          data: {
            volunteerId,
            mealId: selection.mealId,
            accepted: selection.accepted,
          },
        })
      }

      // Sinon, mettre à jour la sélection existante
      return prisma.volunteerMealSelection.update({
        where: {
          id: selection.selectionId,
          volunteerId, // Sécurité: vérifier que la sélection appartient à ce bénévole
        },
        data: {
          accepted: selection.accepted,
        },
      })
    })

    await Promise.all(updatePromises)

    // Récupérer les informations du bénévole pour calculer l'éligibilité
    const volunteerInfo = await prisma.editionVolunteerApplication.findUnique({
      where: { id: volunteerId },
      select: {
        setupAvailability: true,
        eventAvailability: true,
        teardownAvailability: true,
        arrivalDateTime: true,
        departureDateTime: true,
      },
    })

    // Récupérer les repas mis à jour
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

    // Import de la fonction d'éligibilité
    const { isVolunteerEligibleForMeal } = await import('@@/server/utils/volunteer-meals')

    // Formater les repas avec les sélections du bénévole et l'éligibilité
    const formattedMeals = meals.map((meal) => {
      const selection = meal.mealSelections[0]

      // Vérifier l'éligibilité du bénévole pour ce repas
      const eligible = volunteerInfo
        ? isVolunteerEligibleForMeal(
            {
              date: meal.date,
              mealType: meal.mealType,
              phase: meal.phase,
            },
            {
              setupAvailability: volunteerInfo.setupAvailability,
              eventAvailability: volunteerInfo.eventAvailability,
              teardownAvailability: volunteerInfo.teardownAvailability,
              arrivalDateTime: volunteerInfo.arrivalDateTime,
              departureDateTime: volunteerInfo.departureDateTime,
            }
          )
        : true

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
    console.error('Failed to update volunteer meals:', error)

    // Si c'est déjà une erreur HTTP, la relancer
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la mise à jour des repas du bénévole',
    })
  }
})
