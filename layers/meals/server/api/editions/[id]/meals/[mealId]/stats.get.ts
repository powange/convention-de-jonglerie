import { useMealsPorts } from '#server/meals/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageMealsOrValidation } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const mealId = validateResourceId(event, 'mealId', 'repas')

    const allowed = await canManageMealsOrValidation(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    // Vérifier que le repas existe et appartient à cette édition
    const meal = await prisma.volunteerMeal.findFirst({ where: { id: mealId, editionId } })
    if (!meal) {
      throw createError({
        status: 404,
        message: 'Repas non trouvé',
      })
    }

    const ports = useMealsPorts()

    // 1. Compter les bénévoles ayant accès à ce repas
    const volunteerCount = await prisma.volunteerMealSelection.count({
      where: {
        mealId,
        volunteer: {
          eventId: editionId,
          status: 'ACCEPTED',
        },
      },
    })

    const volunteerValidatedCount = await prisma.volunteerMealSelection.count({
      where: {
        mealId,
        volunteer: {
          eventId: editionId,
          status: 'ACCEPTED',
        },
        consumedAt: { not: null },
      },
    })

    // 2. Compter les artistes ayant accès à ce repas (via le port artists)
    const artistSelections = await ports.artists.listMealSelections(editionId, mealId)
    const artistCount = artistSelections.length
    const artistValidatedCount = artistSelections.filter((s) => s.consumedAt !== null).length

    // 3. Compter les participants billetterie (via le port ticketing, déjà dédupliqués)
    const ticketRows = await ports.ticketing.listMealTicketParticipants(mealId)
    const participantCount = ticketRows.length
    const participantValidatedCount = ticketRows.filter((r) => r.consumedAt !== null).length

    // 4. Compter les organisateurs présents ayant accès à ce repas (accès par défaut, hors
    // exception explicite) et ceux dont la consommation est déjà tracée.
    const organizerCount = await prisma.editionOrganizer.count({
      where: {
        editionId,
        NOT: { mealSelections: { some: { mealId, accepted: false } } },
      },
    })

    const organizerValidatedCount = await prisma.organizerMealSelection.count({
      where: {
        mealId,
        accepted: true,
        consumedAt: { not: null },
        editionOrganizer: { editionId },
      },
    })

    const total = volunteerCount + artistCount + participantCount + organizerCount
    const validated =
      volunteerValidatedCount +
      artistValidatedCount +
      participantValidatedCount +
      organizerValidatedCount

    return createSuccessResponse({
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
          organizers: {
            total: organizerCount,
            validated: organizerValidatedCount,
          },
        },
      },
    })
  },
  { operationName: 'GetMealStats' }
)
