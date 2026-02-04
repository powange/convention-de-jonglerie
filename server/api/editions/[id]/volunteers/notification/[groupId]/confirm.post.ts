import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  const groupId = getRouterParam(event, 'groupId')

  if (!groupId) {
    throw createError({ status: 400, message: 'ID de groupe requis' })
  }

  // Vérifier que le groupe de notifications existe
  const notificationGroup = await prisma.volunteerNotificationGroup.findFirst({
    where: {
      id: groupId,
      editionId,
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

  // Vérifier si déjà confirmé
  const existingConfirmation = await prisma.volunteerNotificationConfirmation.findFirst({
    where: {
      volunteerNotificationGroupId: groupId,
      userId: user.id,
    },
  })

  if (!existingConfirmation) {
    throw createError({ status: 404, message: 'Aucune notification à confirmer' })
  }

  // Si déjà confirmé (confirmedAt n'est pas null)
  if (existingConfirmation.confirmedAt) {
    return {
      success: true,
      alreadyConfirmed: true,
      confirmedAt: existingConfirmation.confirmedAt,
    }
  }

  // Mettre à jour la confirmation avec la date actuelle
  const confirmation = await prisma.volunteerNotificationConfirmation.update({
    where: {
      id: existingConfirmation.id,
    },
    data: {
      confirmedAt: new Date(),
    },
  })

  // Marquer la notification correspondante comme lue
  // Chercher la notification qui correspond à ce groupe et cet utilisateur
  const userNotification = await prisma.notification.findFirst({
    where: {
      userId: user.id,
      category: 'volunteer',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: `/editions/${editionId}/volunteers/notification/${groupId}/confirm`,
      isRead: false,
    },
  })

  if (userNotification) {
    await prisma.notification.update({
      where: {
        id: userNotification.id,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  return {
    success: true,
    alreadyConfirmed: false,
    confirmedAt: confirmation.confirmedAt,
  }
}, 'ConfirmVolunteerNotification')
