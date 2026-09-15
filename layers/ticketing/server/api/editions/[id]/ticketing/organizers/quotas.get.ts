import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/ticketing/organizers/quotas
 *
 * Toutes les associations quota ↔ organisateur de l'édition, globales comprises.
 *
 * Une seule requête, là où l'endpoint jumeau des articles à remettre en fait deux et recolle les
 * résultats à la main : il s'en explique par l'absence de relation vers l'article sur sa table de
 * liaison. `EditionOrganizerQuota` la déclare, donc `include` suffit.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const associations = await prisma.editionOrganizerQuota.findMany({
      where: { editionId },
      include: {
        quota: { select: { id: true, title: true, quantity: true, position: true } },
      },
      // `organizerId` croissant place les lignes globales (NULL) en tête, ce qui est l'ordre
      // d'affichage de l'écran : ce qui vaut pour tous, puis les cas particuliers.
      orderBy: [{ organizerId: 'asc' }, { quotaId: 'asc' }],
    })

    return createSuccessResponse({
      quotas: associations.map((association) => ({
        id: association.id,
        quotaId: association.quotaId,
        organizerId: association.organizerId,
        quota: association.quota,
      })),
    })
  },
  { operationName: 'GET ticketing organizer quotas' }
)
