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

    // Récupérer le terme de recherche
    const query = getQuery(event)
    const searchTerm = (query.q as string) || ''

    if (!searchTerm || searchTerm.length < 2) {
      return { results: [] }
    }

    const searchLower = searchTerm.toLowerCase()

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

    const results: any[] = []

    // 1. Rechercher dans les bénévoles qui ont accès à ce repas
    const volunteerMealSelections = await prisma.volunteerMealSelection.findMany({
      where: {
        mealId,
        volunteer: {
          editionId,
          status: 'ACCEPTED',
        },
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
      const matchesSearch =
        volunteer.user.nom?.toLowerCase().includes(searchLower) ||
        volunteer.user.prenom?.toLowerCase().includes(searchLower) ||
        volunteer.user.pseudo?.toLowerCase().includes(searchLower) ||
        volunteer.user.email?.toLowerCase().includes(searchLower)

      if (matchesSearch) {
        results.push({
          uniqueId: `volunteer-${selection.id}`,
          id: selection.id,
          type: 'volunteer',
          firstName: volunteer.user.prenom,
          lastName: volunteer.user.nom,
          pseudo: volunteer.user.pseudo,
          email: volunteer.user.email,
          phone: volunteer.user.phone,
          consumedAt: selection.consumedAt,
        })
      }
    }

    // 2. Rechercher dans les artistes qui ont accès à ce repas
    const artistMealSelections = await prisma.artistMealSelection.findMany({
      where: {
        mealId,
        artist: {
          editionId,
        },
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
      const matchesSearch =
        artist.user.nom?.toLowerCase().includes(searchLower) ||
        artist.user.prenom?.toLowerCase().includes(searchLower) ||
        artist.user.pseudo?.toLowerCase().includes(searchLower) ||
        artist.user.email?.toLowerCase().includes(searchLower)

      if (matchesSearch) {
        results.push({
          uniqueId: `artist-${selection.id}`,
          id: selection.id,
          type: 'artist',
          firstName: artist.user.prenom,
          lastName: artist.user.nom,
          pseudo: artist.user.pseudo,
          email: artist.user.email,
          phone: artist.user.phone,
          consumedAt: selection.consumedAt,
        })
      }
    }

    // 3. Rechercher dans les participants (via les tarifs ET options ayant accès à ce repas)
    // Structure identique à participants.get.ts
    const addedOrderItemIds = new Set<number>()

    // Parcourir les orderItems via les tarifs
    for (const tierMeal of meal.tiers) {
      for (const item of tierMeal.tier.orderItems) {
        addedOrderItemIds.add(item.id)

        const matchesSearch =
          item.lastName?.toLowerCase().includes(searchLower) ||
          item.firstName?.toLowerCase().includes(searchLower) ||
          item.email?.toLowerCase().includes(searchLower)

        if (matchesSearch) {
          // Trouver si ce participant a déjà une validation de repas
          const mealValidation = item.mealAccess.find((ma) => ma.consumedAt !== null)

          results.push({
            uniqueId: `participant-${item.id}`,
            id: item.id,
            type: 'participant',
            firstName: item.firstName,
            lastName: item.lastName,
            pseudo: null,
            email: item.email,
            phone: null,
            consumedAt: mealValidation?.consumedAt || null,
          })
        }
      }
    }

    // 4. Rechercher dans les participants via les options
    for (const optionMeal of meal.options) {
      for (const selection of optionMeal.option.orderItemSelections) {
        const item = selection.orderItem

        // Éviter les doublons : si le participant a déjà le repas via un tarif
        if (addedOrderItemIds.has(item.id)) {
          continue
        }
        addedOrderItemIds.add(item.id)

        const matchesSearch =
          item.lastName?.toLowerCase().includes(searchLower) ||
          item.firstName?.toLowerCase().includes(searchLower) ||
          item.email?.toLowerCase().includes(searchLower)

        if (matchesSearch) {
          // Trouver si ce participant a déjà une validation de repas
          const mealValidation = item.mealAccess.find((ma) => ma.consumedAt !== null)

          results.push({
            uniqueId: `participant-${item.id}`,
            id: item.id,
            type: 'participant',
            firstName: item.firstName,
            lastName: item.lastName,
            pseudo: null,
            email: item.email,
            phone: null,
            consumedAt: mealValidation?.consumedAt || null,
          })
        }
      }
    }

    return { results }
  },
  { operationName: 'SearchMealParticipants' }
)
