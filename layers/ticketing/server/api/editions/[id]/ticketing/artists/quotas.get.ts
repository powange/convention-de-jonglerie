import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/ticketing/artists/quotas
 *
 * Les associations quota ↔ artistes de l'édition, ligne globale comprise.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const associations = await prisma.editionArtistQuota.findMany({
      where: { editionId },
      include: { quota: { select: { id: true, title: true, quantity: true, position: true } } },
      // `showId` croissant place la ligne globale (NULL) en tête.
      orderBy: [{ showId: 'asc' }, { quotaId: 'asc' }],
    })

    return createSuccessResponse({
      quotas: associations.map((association) => ({
        id: association.id,
        quotaId: association.quotaId,
        showId: association.showId,
        quota: association.quota,
      })),
    })
  },
  { operationName: 'GET ticketing artist quotas' }
)
