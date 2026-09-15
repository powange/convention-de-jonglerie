import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/ticketing/volunteers/quotas
 *
 * Les associations quota ↔ bénévoles de l'édition, ligne globale comprise.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const associations = await prisma.editionVolunteerQuota.findMany({
      where: { editionId },
      include: { quota: { select: { id: true, title: true, quantity: true, position: true } } },
      // `teamId` croissant place la ligne globale (NULL) en tête : ce qui vaut pour tous, puis
      // les équipes.
      orderBy: [{ teamId: 'asc' }, { quotaId: 'asc' }],
    })

    return createSuccessResponse({
      quotas: associations.map((association) => ({
        id: association.id,
        quotaId: association.quotaId,
        teamId: association.teamId,
        quota: association.quota,
      })),
    })
  },
  { operationName: 'GET ticketing volunteer quotas' }
)
