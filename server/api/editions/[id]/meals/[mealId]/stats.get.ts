import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionDataOrMealValidation } from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const mealId = validateResourceId(event, 'mealId', 'repas')

    const allowed = await canAccessEditionDataOrMealValidation(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

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

    // 3. Compter les participants ayant accès à ce repas (via tarifs ET options, avec déduplication)
    // D'abord, récupérer tous les tarifs qui donnent accès à ce repas
    const tierMeals = await prisma.ticketingTierMeal.findMany({
      where: { mealId },
      select: { tierId: true },
    })

    const tierIds = tierMeals.map((tm) => tm.tierId)

    // Récupérer toutes les options qui donnent accès à ce repas
    const optionMeals = await prisma.ticketingOptionMeal.findMany({
      where: { mealId },
      select: { optionId: true },
    })

    const optionIds = optionMeals.map((om) => om.optionId)

    // Pour compter avec déduplication, on récupère tous les orderItems uniques
    const uniqueOrderItemIds = new Set<number>()
    const validatedOrderItemIds = new Set<number>()

    // Récupérer les orderItems via les tarifs
    if (tierIds.length > 0) {
      const orderItemsFromTiers = await prisma.ticketingOrderItem.findMany({
        where: {
          tierId: { in: tierIds },
          state: { in: ['Valid', 'Processed'] },
          order: {
            editionId,
            status: 'Processed',
          },
        },
        select: {
          id: true,
          mealAccess: {
            where: { mealId, consumedAt: { not: null } },
            select: { id: true },
          },
        },
      })

      for (const item of orderItemsFromTiers) {
        uniqueOrderItemIds.add(item.id)
        if (item.mealAccess.length > 0) {
          validatedOrderItemIds.add(item.id)
        }
      }
    }

    // Récupérer les orderItems via les options (déduplication)
    if (optionIds.length > 0) {
      const orderItemSelectionsFromOptions = await prisma.ticketingOrderItemSelection.findMany({
        where: {
          optionId: { in: optionIds },
          orderItem: {
            state: { in: ['Valid', 'Processed'] },
            order: {
              editionId,
              status: 'Processed',
            },
          },
        },
        select: {
          orderItem: {
            select: {
              id: true,
              mealAccess: {
                where: { mealId, consumedAt: { not: null } },
                select: { id: true },
              },
            },
          },
        },
      })

      for (const selection of orderItemSelectionsFromOptions) {
        const item = selection.orderItem
        // Ajouter uniquement si pas déjà ajouté via tarif
        if (!uniqueOrderItemIds.has(item.id)) {
          uniqueOrderItemIds.add(item.id)
          if (item.mealAccess.length > 0) {
            validatedOrderItemIds.add(item.id)
          }
        }
      }
    }

    const participantCount = uniqueOrderItemIds.size
    const participantValidatedCount = validatedOrderItemIds.size

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
  },
  { operationName: 'GetMealStats' }
)
