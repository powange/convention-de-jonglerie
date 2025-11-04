import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionDataOrMealValidation } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const mealId = parseInt(getRouterParam(event, 'mealId') || '0')

    if (!mealId) {
      throw createError({ statusCode: 400, message: 'Paramètres invalides' })
    }

    const allowed = await canAccessEditionDataOrMealValidation(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    // Récupérer le type demandé
    const query = getQuery(event)
    const type = (query.type as string) || 'all' // 'volunteer', 'artist', 'participant', 'all'

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

    // 3. Participants non validés
    if (type === 'participant' || type === 'all') {
      // Récupérer tous les tarifs qui donnent accès à ce repas
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
          // Vérifier si ce participant n'a pas encore validé son repas
          const hasValidated = item.mealAccess.some(
            (ma) => ma.mealId === mealId && ma.consumedAt !== null
          )

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
