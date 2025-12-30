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

    // Récupérer le terme de recherche
    const query = getQuery(event)
    const searchTerm = (query.q as string) || ''

    if (!searchTerm || searchTerm.length < 2) {
      return { results: [] }
    }

    const searchLower = searchTerm.toLowerCase()

    // Vérifier que le repas existe et appartient à cette édition
    // On inclut les relations tiers et options pour éviter des requêtes séparées
    const meal = await prisma.volunteerMeal.findFirst({
      where: {
        id: mealId,
        editionId,
      },
      include: {
        tiers: { select: { tierId: true } },
        options: { select: { optionId: true } },
      },
    })

    if (!meal) {
      throw createError({
        statusCode: 404,
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
    // Set pour suivre les orderItems déjà ajoutés (déduplication tarif/option)
    const addedOrderItemIds = new Set<number>()

    // Utiliser les relations déjà chargées avec le meal
    const tierIds = meal.tiers.map((t) => t.tierId)

    if (tierIds.length > 0) {
      // Récupérer tous les orderItems qui ont un de ces tarifs
      const orderItems = await prisma.ticketingOrderItem.findMany({
        where: {
          tierId: { in: tierIds },
          state: { in: ['Valid', 'Processed'] },
          order: {
            editionId,
            status: 'Processed',
          },
        },
        include: {
          mealAccess: {
            where: { mealId },
          },
        },
      })

      for (const item of orderItems) {
        addedOrderItemIds.add(item.id)

        const matchesSearch =
          item.lastName?.toLowerCase().includes(searchLower) ||
          item.firstName?.toLowerCase().includes(searchLower) ||
          item.email?.toLowerCase().includes(searchLower)

        if (matchesSearch) {
          // Trouver si ce participant a déjà une validation de repas
          const mealValidation = item.mealAccess.find((ma) => ma.mealId === mealId)

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

    // 4. Rechercher dans les participants via les options ayant accès à ce repas
    // Utiliser les relations déjà chargées avec le meal
    const optionIds = meal.options.map((o) => o.optionId)

    if (optionIds.length > 0) {
      // Récupérer les orderItemSelections qui ont ces options
      const orderItemSelections = await prisma.ticketingOrderItemOption.findMany({
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
        include: {
          orderItem: {
            include: {
              mealAccess: {
                where: { mealId },
              },
            },
          },
        },
      })

      for (const selection of orderItemSelections) {
        const item = selection.orderItem

        // Éviter les doublons : si le participant a déjà le repas via un tarif, ne pas l'ajouter
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
          const mealValidation = item.mealAccess.find((ma) => ma.mealId === mealId)

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
