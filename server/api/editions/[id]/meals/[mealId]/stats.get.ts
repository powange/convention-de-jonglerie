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
    // On inclut les relations tiers et options avec les orderItems pour éviter des requêtes séparées
    const meal = await prisma.volunteerMeal.findFirst({
      where: {
        id: mealId,
        editionId,
      },
      include: {
        tiers: {
          include: {
            tier: {
              include: {
                orderItems: {
                  where: {
                    state: { in: ['Valid', 'Processed'] },
                    order: { editionId, status: 'Processed' },
                  },
                  select: {
                    id: true,
                    mealAccess: {
                      where: { mealId },
                      select: { id: true, consumedAt: true },
                    },
                  },
                },
              },
            },
          },
        },
        options: {
          include: {
            option: {
              include: {
                orderItemSelections: {
                  where: {
                    orderItem: {
                      state: { in: ['Valid', 'Processed'] },
                      order: { editionId, status: 'Processed' },
                    },
                  },
                  include: {
                    orderItem: {
                      select: {
                        id: true,
                        mealAccess: {
                          where: { mealId },
                          select: { id: true, consumedAt: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
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
    // Utiliser les relations déjà chargées avec le meal (évite les requêtes directes sur les modèles)
    const uniqueOrderItemIds = new Set<number>()
    const validatedOrderItemIds = new Set<number>()

    // Compter les orderItems via les tarifs (déjà chargés via les relations imbriquées)
    for (const tierMeal of meal.tiers) {
      for (const orderItem of tierMeal.tier.orderItems) {
        uniqueOrderItemIds.add(orderItem.id)
        // Vérifier si le repas a été consommé
        const hasConsumed = orderItem.mealAccess.some((ma) => ma.consumedAt !== null)
        if (hasConsumed) {
          validatedOrderItemIds.add(orderItem.id)
        }
      }
    }

    // Compter les orderItems via les options (déjà chargés via les relations imbriquées)
    for (const optionMeal of meal.options) {
      for (const selection of optionMeal.option.orderItemSelections) {
        const orderItem = selection.orderItem
        // Ajouter uniquement si pas déjà ajouté via tarif (déduplication)
        if (!uniqueOrderItemIds.has(orderItem.id)) {
          uniqueOrderItemIds.add(orderItem.id)
          // Vérifier si le repas a été consommé
          const hasConsumed = orderItem.mealAccess.some((ma) => ma.consumedAt !== null)
          if (hasConsumed) {
            validatedOrderItemIds.add(orderItem.id)
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
