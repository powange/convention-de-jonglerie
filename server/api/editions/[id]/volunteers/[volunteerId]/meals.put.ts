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

    // Mettre à jour les sélections de repas
    const updatePromises = body.selections.map((selection: any) => {
      if (!selection.selectionId) {
        // Si pas de selectionId, ignorer (le repas n'existait pas)
        return Promise.resolve()
      }

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

    // Formater les repas avec les sélections du bénévole
    const formattedMeals = meals.map((meal) => {
      const selection = meal.mealSelections[0]
      return {
        id: meal.id,
        date: meal.date,
        mealType: meal.mealType,
        phase: meal.phase,
        selectionId: selection?.id || null,
        accepted: selection?.accepted || false,
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
