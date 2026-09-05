import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Confirme la lecture d'un envoi groupé aux artistes.
 *
 * L'autorisation ne repose pas sur le statut d'artiste au moment du clic mais sur la ligne
 * de confirmation créée à l'envoi : c'est elle qui atteste que la personne était bien
 * destinataire, et elle survit à un retrait de la distribution.
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  const groupId = getRouterParam(event, 'groupId')

  if (!groupId) {
    throw createError({ status: 400, message: 'ID de groupe requis' })
  }

  const groupe = await prisma.artistNotificationGroup.findFirst({
    where: { id: groupId, editionId },
  })

  if (!groupe) {
    throw createError({ status: 404, message: 'Notification introuvable' })
  }

  const confirmation = await prisma.artistNotificationConfirmation.findFirst({
    where: { artistNotificationGroupId: groupId, userId: user.id },
  })

  if (!confirmation) {
    throw createError({ status: 403, message: 'Accès non autorisé' })
  }

  if (confirmation.confirmedAt) {
    return createSuccessResponse({
      alreadyConfirmed: true,
      confirmedAt: confirmation.confirmedAt,
      message: groupe.message,
      title: groupe.title,
      sentAt: groupe.sentAt,
    })
  }

  const confirmedAt = new Date()
  await prisma.artistNotificationConfirmation.update({
    where: { id: confirmation.id },
    data: { confirmedAt },
  })

  return createSuccessResponse({
    alreadyConfirmed: false,
    confirmedAt,
    message: groupe.message,
    title: groupe.title,
    sentAt: groupe.sentAt,
  })
}, { operationName: 'ConfirmArtistNotification' })
