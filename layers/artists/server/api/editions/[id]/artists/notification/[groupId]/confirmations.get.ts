import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageArtistsById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Qui a confirmé la lecture d'un envoi, et qui manque encore à l'appel.
 *
 * Les non-confirmés d'abord : c'est eux qu'un organisateur cherche, pas ceux qui ont déjà lu.
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  const groupId = getRouterParam(event, 'groupId')

  if (!groupId) {
    throw createError({ status: 400, message: 'ID de groupe requis' })
  }

  if (!(await canManageArtistsById(editionId, user.id, event))) {
    throw createError({ status: 403, message: 'Droits insuffisants' })
  }

  const groupe = await prisma.artistNotificationGroup.findFirst({
    where: { id: groupId, editionId },
    select: { id: true, title: true, message: true, sentAt: true, recipientCount: true },
  })

  if (!groupe) {
    throw createError({ status: 404, message: 'Notification introuvable' })
  }

  const confirmations = await prisma.artistNotificationConfirmation.findMany({
    where: { artistNotificationGroupId: groupId },
    orderBy: [{ confirmedAt: 'asc' }],
    select: {
      id: true,
      confirmedAt: true,
      // Le téléphone sert à relancer par SMS ceux qui n'ont pas confirmé ; le reste
      // identifie la personne dans la liste.
      user: {
        select: {
          id: true,
          pseudo: true,
          prenom: true,
          nom: true,
          phone: true,
          profilePicture: true,
        },
      },
    },
  })

  return createSuccessResponse({
    notification: groupe,
    confirmations,
    confirmedCount: confirmations.filter((c) => c.confirmedAt).length,
  })
}, { operationName: 'ListArtistNotificationConfirmations' })
