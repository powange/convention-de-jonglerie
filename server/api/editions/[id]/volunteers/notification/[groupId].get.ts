import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  const groupId = getRouterParam(event, 'groupId')

  if (!groupId) {
    throw createError({ statusCode: 400, message: 'ID de groupe requis' })
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
        select: { pseudo: true },
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
    throw createError({ statusCode: 404, message: 'Notification introuvable' })
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
    throw createError({ statusCode: 403, message: 'Accès non autorisé' })
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
