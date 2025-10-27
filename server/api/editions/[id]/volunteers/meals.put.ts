import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  const body = await readBody(event)

  // Valider le body
  if (!body.meals || !Array.isArray(body.meals)) {
    throw createError({
      statusCode: 400,
      message: 'Format de données invalide',
    })
  }

  try {
    // Mettre à jour les repas fournis
    const updatePromises = body.meals.map((meal: any) => {
      if (!meal.id) {
        throw createError({
          statusCode: 400,
          message: 'ID de repas manquant',
        })
      }

      return prisma.volunteerMeal.update({
        where: {
          id: meal.id,
          editionId, // Sécurité : vérifier que le repas appartient à cette édition
        },
        data: {
          enabled: meal.enabled ?? undefined,
          phase: meal.phase ?? undefined,
        },
      })
    })

    await Promise.all(updatePromises)

    // Récupérer tous les repas mis à jour
    const updatedMeals = await prisma.volunteerMeal.findMany({
      where: { editionId },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })

    return {
      success: true,
      meals: updatedMeals,
    }
  } catch (error: unknown) {
    console.error('Failed to update volunteer meals:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la mise à jour des repas bénévoles',
    })
  }
})
