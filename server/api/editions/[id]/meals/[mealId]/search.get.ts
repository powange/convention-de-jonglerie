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
    // Récupérer le terme de recherche
    const query = getQuery(event)
    const searchTerm = (query.q as string) || ''

    if (!searchTerm || searchTerm.length < 2) {
      return { results: [] }
    }

    const searchLower = searchTerm.toLowerCase()

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

    // 3. Rechercher dans les participants (via les tarifs ayant accès à ce repas)
    // D'abord, récupérer tous les tarifs qui donnent accès à ce repas
    const tierMeals = await prisma.ticketingTierMeal.findMany({
      where: { mealId },
      select: { tierId: true },
    })

    const tierIds = tierMeals.map((tm) => tm.tierId)

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
  } catch (error: unknown) {
    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors de la recherche de personnes:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la recherche de personnes',
    })
  }
})
