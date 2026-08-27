import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageArtistsById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Historique des envois groupés aux artistes d'une édition, du plus récent au plus ancien.
 *
 * Le décompte des confirmations accompagne chaque envoi : sans lui, la liste dirait ce qui a
 * été annoncé sans dire si quelqu'un l'a lu.
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  if (!(await canManageArtistsById(editionId, user.id, event))) {
    throw createError({ status: 403, message: 'Droits insuffisants' })
  }

  const groupes = await prisma.artistNotificationGroup.findMany({
    where: { editionId },
    orderBy: { sentAt: 'desc' },
    select: {
      id: true,
      title: true,
      message: true,
      targetType: true,
      selectedShows: true,
      recipientCount: true,
      sentAt: true,
      sender: { select: { id: true, pseudo: true } },
      _count: { select: { confirmations: { where: { confirmedAt: { not: null } } } } },
    },
  })

  return createSuccessResponse({
    notifications: groupes.map(({ _count, ...groupe }) => ({
      ...groupe,
      confirmedCount: _count.confirmations,
    })),
  })
}, 'ListArtistNotifications')
