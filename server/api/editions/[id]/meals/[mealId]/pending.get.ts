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
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    // Récupérer le type demandé
    const query = getQuery(event)
    const type = (query.type as string) || 'all' // 'volunteer', 'artist', 'participant', 'all'

    // Vérifier que le repas existe et appartient à cette édition
    // Structure identique à participants.get.ts qui fonctionne
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
                    entryValidated: true,
                  },
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
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
        // Structure identique à participants.get.ts
        options: {
          include: {
            option: {
              include: {
                orderItemSelections: {
                  where: {
                    orderItem: {
                      entryValidated: true,
                    },
                  },
                  include: {
                    orderItem: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
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
        status: 404,
        message: 'Repas non trouvé',
      })
    }

    const pending: any[] = []

    // 1. Bénévoles non validés
    if (type === 'volunteer' || type === 'all') {
      const volunteerMealSelections = await prisma.volunteerMealSelection.findMany({
        where: {
          mealId,
          volunteer: {
            editionId,
            status: 'ACCEPTED',
          },
          consumedAt: null, // Non validé
        },
        include: {
          volunteer: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  prenom: true,
                  nom: true,
                  pseudo: true,
                  phone: true,
                },
              },
            },
          },
        },
      })

      for (const selection of volunteerMealSelections) {
        const volunteer = selection.volunteer
        pending.push({
          uniqueId: `volunteer-${selection.id}`,
          id: selection.id,
          type: 'volunteer',
          firstName: volunteer.user.prenom,
          lastName: volunteer.user.nom,
          pseudo: volunteer.user.pseudo,
          email: volunteer.user.email,
          phone: volunteer.user.phone,
        })
      }
    }

    // 2. Artistes non validés
    if (type === 'artist' || type === 'all') {
      const artistMealSelections = await prisma.artistMealSelection.findMany({
        where: {
          mealId,
          artist: {
            editionId,
          },
          consumedAt: null, // Non validé
        },
        include: {
          artist: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  prenom: true,
                  nom: true,
                  pseudo: true,
                  phone: true,
                },
              },
            },
          },
        },
      })

      for (const selection of artistMealSelections) {
        const artist = selection.artist
        pending.push({
          uniqueId: `artist-${selection.id}`,
          id: selection.id,
          type: 'artist',
          firstName: artist.user.prenom,
          lastName: artist.user.nom,
          pseudo: artist.user.pseudo,
          email: artist.user.email,
          phone: artist.user.phone,
        })
      }
    }

    // 3. Participants non validés (via tarifs ET options, avec déduplication)
    // Structure identique à participants.get.ts
    if (type === 'participant' || type === 'all') {
      const addedOrderItemIds = new Set<number>()

      // Parcourir les orderItems via les tarifs
      for (const tierMeal of meal.tiers) {
        for (const item of tierMeal.tier.orderItems) {
          addedOrderItemIds.add(item.id)

          // Vérifier si ce participant n'a pas encore validé son repas
          const hasValidated = item.mealAccess.some((ma) => ma.consumedAt !== null)

          if (!hasValidated) {
            pending.push({
              uniqueId: `participant-${item.id}`,
              id: item.id,
              type: 'participant',
              firstName: item.firstName,
              lastName: item.lastName,
              pseudo: null,
              email: item.email,
              phone: null,
            })
          }
        }
      }

      // Parcourir les orderItems via les options
      for (const optionMeal of meal.options) {
        for (const selection of optionMeal.option.orderItemSelections) {
          const item = selection.orderItem

          // Éviter les doublons : si le participant a déjà le repas via un tarif
          if (addedOrderItemIds.has(item.id)) {
            continue
          }
          addedOrderItemIds.add(item.id)

          // Vérifier si ce participant n'a pas encore validé son repas
          const hasValidated = item.mealAccess.some((ma) => ma.consumedAt !== null)

          if (!hasValidated) {
            pending.push({
              uniqueId: `participant-${item.id}`,
              id: item.id,
              type: 'participant',
              firstName: item.firstName,
              lastName: item.lastName,
              pseudo: null,
              email: item.email,
              phone: null,
            })
          }
        }
      }
    }

    return {
      success: true,
      pending,
      count: pending.length,
    }
  },
  { operationName: 'GetPendingMealValidations' }
)
