import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { userBasicSelect } from '@@/server/utils/prisma-select-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  const groupId = getRouterParam(event, 'groupId')

  if (!groupId) {
    throw createError({ status: 400, message: 'ID de groupe requis' })
  }

  // Récupérer le groupe de notifications
  const notificationGroup = await prisma.volunteerNotificationGroup.findFirst({
    where: {
      id: groupId,
      editionId,
    },
    include: {
      edition: {
        select: {
          name: true,
          convention: {
            select: { name: true },
          },
        },
      },
      sender: {
        select: userBasicSelect,
      },
      confirmations: {
        where: {
          userId: user.id,
        },
        select: {
          confirmedAt: true,
        },
      },
    },
  })

  if (!notificationGroup) {
    throw createError({ status: 404, message: 'Notification introuvable' })
  }

  // Vérifier que l'utilisateur est un bénévole accepté de cette édition
  const volunteerApplication = await prisma.editionVolunteerApplication.findFirst({
    where: {
      editionId,
      userId: user.id,
      status: 'ACCEPTED',
    },
  })

  if (!volunteerApplication) {
    throw createError({ status: 403, message: 'Accès non autorisé' })
  }

  const confirmation =
    notificationGroup.confirmations.length > 0 ? notificationGroup.confirmations[0] : null
  const isConfirmed = confirmation && confirmation.confirmedAt !== null
  const confirmedAt = isConfirmed ? confirmation.confirmedAt : null

  const displayName = notificationGroup.edition.name || notificationGroup.edition.convention.name

  return {
    notification: {
      id: notificationGroup.id,
      title: notificationGroup.title,
      message: notificationGroup.message,
      sentAt: notificationGroup.sentAt,
      senderName: notificationGroup.sender.pseudo,
      editionName: displayName,
    },
    isConfirmed,
    confirmedAt,
  }
}, 'GetVolunteerNotificationGroup')
