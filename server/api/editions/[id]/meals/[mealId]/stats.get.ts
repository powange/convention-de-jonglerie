import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionDataOrMealValidation } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const mealId = parseInt(getRouterParam(event, 'mealId') || '0')

  if (!editionId || !mealId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  const allowed = await canAccessEditionDataOrMealValidation(editionId, user.id, event)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })
  }

  try {
    // Vérifier que le repas existe et appartient à cette édition
    const meal = await prisma.volunteerMeal.findFirst({
      where: {
        id: mealId,
        editionId,
      },
    })

    if (!meal) {
      throw createError({
        statusCode: 404,
        message: 'Repas non trouvé',
      })
    }

    // 1. Compter les bénévoles ayant accès à ce repas
    const volunteerCount = await prisma.volunteerMealSelection.count({
      where: {
        mealId,
        volunteer: {
          editionId,
          status: 'ACCEPTED',
        },
      },
    })

    const volunteerValidatedCount = await prisma.volunteerMealSelection.count({
      where: {
        mealId,
        volunteer: {
          editionId,
          status: 'ACCEPTED',
        },
        consumedAt: { not: null },
      },
    })

    // 2. Compter les artistes ayant accès à ce repas
    const artistCount = await prisma.artistMealSelection.count({
      where: {
        mealId,
        artist: {
          editionId,
        },
      },
    })

    const artistValidatedCount = await prisma.artistMealSelection.count({
      where: {
        mealId,
        artist: {
          editionId,
        },
        consumedAt: { not: null },
      },
    })

    // 3. Compter les participants ayant accès à ce repas
    // D'abord, récupérer tous les tarifs qui donnent accès à ce repas
    const tierMeals = await prisma.ticketingTierMeal.findMany({
      where: { mealId },
      select: { tierId: true },
    })

    const tierIds = tierMeals.map((tm) => tm.tierId)

    let participantCount = 0
    let participantValidatedCount = 0

    if (tierIds.length > 0) {
      // Compter tous les orderItems qui ont un de ces tarifs
      participantCount = await prisma.ticketingOrderItem.count({
        where: {
          tierId: { in: tierIds },
          state: { in: ['Valid', 'Processed'] },
          order: {
            editionId,
            status: 'Processed',
          },
        },
      })

      // Compter les participants qui ont validé leur repas
      participantValidatedCount = await prisma.ticketingOrderItemMeal.count({
        where: {
          mealId,
          consumedAt: { not: null },
          orderItem: {
            tierId: { in: tierIds },
            state: { in: ['Valid', 'Processed'] },
            order: {
              editionId,
              status: 'Processed',
            },
          },
        },
      })
    }

    const total = volunteerCount + artistCount + participantCount
    const validated = volunteerValidatedCount + artistValidatedCount + participantValidatedCount

    return {
      success: true,
      stats: {
        total,
        validated,
        percentage: total > 0 ? Math.round((validated / total) * 100) : 0,
        breakdown: {
          volunteers: {
            total: volunteerCount,
            validated: volunteerValidatedCount,
          },
          artists: {
            total: artistCount,
            validated: artistValidatedCount,
          },
          participants: {
            total: participantCount,
            validated: participantValidatedCount,
          },
        },
      },
    }
  } catch (error: unknown) {
    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors du calcul des statistiques du repas:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors du calcul des statistiques du repas',
    })
  }
})
