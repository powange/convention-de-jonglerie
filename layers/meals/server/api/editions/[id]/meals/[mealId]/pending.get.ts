import { useMealsPorts } from '#server/meals/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrMealValidation } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

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
    const meal = await prisma.volunteerMeal.findFirst({ where: { id: mealId, editionId } })
    if (!meal) {
      throw createError({
        status: 404,
        message: 'Repas non trouvé',
      })
    }

    const ports = useMealsPorts()
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

    // 2. Artistes non validés (via le port artists)
    if (type === 'artist' || type === 'all') {
      const artistSelections = (await ports.artists.listMealSelections(editionId, mealId)).filter(
        (s) => s.consumedAt === null
      )

      for (const row of artistSelections) {
        pending.push({
          uniqueId: `artist-${row.selectionId}`,
          id: row.selectionId,
          type: 'artist',
          firstName: row.prenom,
          lastName: row.nom,
          pseudo: row.pseudo,
          email: row.email,
          phone: row.phone,
        })
      }
    }

    // 3. Participants billetterie non validés (via le port ticketing, déjà dédupliqués)
    if (type === 'participant' || type === 'all') {
      const ticketRows = (await ports.ticketing.listMealTicketParticipants(mealId)).filter(
        (r) => r.consumedAt === null
      )

      for (const row of ticketRows) {
        pending.push({
          uniqueId: `participant-${row.orderItemId}`,
          id: row.orderItemId,
          type: 'participant',
          firstName: row.firstName,
          lastName: row.lastName,
          pseudo: null,
          email: row.email,
          phone: null,
        })
      }
    }

    return createSuccessResponse({ pending, count: pending.length })
  },
  { operationName: 'GetPendingMealValidations' }
)
