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

    // Récupérer le terme de recherche
    const query = getQuery(event)
    const searchTerm = (query.q as string) || ''

    if (!searchTerm || searchTerm.length < 2) {
      return { results: [] }
    }

    const searchLower = searchTerm.toLowerCase()

    // Vérifier que le repas existe et appartient à cette édition
    const meal = await prisma.volunteerMeal.findFirst({ where: { id: mealId, editionId } })
    if (!meal) {
      throw createError({
        status: 404,
        message: 'Repas non trouvé',
      })
    }

    const ports = useMealsPorts()
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

    // 2. Rechercher dans les artistes qui ont accès à ce repas (via le port artists)
    const artistSelections = await ports.artists.listMealSelections(editionId, mealId)

    for (const row of artistSelections) {
      const matchesSearch =
        row.nom?.toLowerCase().includes(searchLower) ||
        row.prenom?.toLowerCase().includes(searchLower) ||
        row.pseudo?.toLowerCase().includes(searchLower) ||
        row.email?.toLowerCase().includes(searchLower)

      if (matchesSearch) {
        results.push({
          uniqueId: `artist-${row.selectionId}`,
          id: row.selectionId,
          type: 'artist',
          firstName: row.prenom,
          lastName: row.nom,
          pseudo: row.pseudo,
          email: row.email,
          phone: row.phone,
          consumedAt: row.consumedAt,
        })
      }
    }

    // 3. Rechercher dans les participants billetterie (via le port ticketing, déjà dédupliqués)
    const ticketRows = await ports.ticketing.listMealTicketParticipants(mealId)

    for (const row of ticketRows) {
      const matchesSearch =
        row.lastName?.toLowerCase().includes(searchLower) ||
        row.firstName?.toLowerCase().includes(searchLower) ||
        row.email?.toLowerCase().includes(searchLower)

      if (matchesSearch) {
        results.push({
          uniqueId: `participant-${row.orderItemId}`,
          id: row.orderItemId,
          type: 'participant',
          firstName: row.firstName,
          lastName: row.lastName,
          pseudo: null,
          email: row.email,
          phone: null,
          consumedAt: row.consumedAt,
        })
      }
    }

    return { results }
  },
  { operationName: 'SearchMealParticipants' }
)
