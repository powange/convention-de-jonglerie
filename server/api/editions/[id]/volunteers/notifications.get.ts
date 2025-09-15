import { canManageEditionVolunteers } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id') || '0')

  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  // Vérifier les permissions
  const canManage = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!canManage) {
    throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })
  }

  // Récupérer la liste des notifications envoyées
  const notifications = await prisma.volunteerNotificationGroup.findMany({
    where: {
      editionId,
    },
    include: {
      sender: {
        select: {
          pseudo: true,
        },
      },
      confirmations: {
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          confirmations: true,
        },
      },
    },
    orderBy: {
      sentAt: 'desc',
    },
  })

  return notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    targetType: notification.targetType,
    selectedTeams: notification.selectedTeams,
    recipientCount: notification.recipientCount,
    sentAt: notification.sentAt,
    senderName: notification.sender.pseudo,
    confirmationsCount: notification._count.confirmations,
    confirmationRate:
      notification.recipientCount > 0
        ? Math.round(
            (notification._count.confirmations / notification.recipientCount) * 100 * 100
          ) / 100
        : 0,
  }))
})
