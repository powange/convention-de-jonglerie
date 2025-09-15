import { prisma } from '../../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const groupId = getRouterParam(event, 'groupId')

  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  if (!groupId) {
    throw createError({ statusCode: 400, statusMessage: 'ID de groupe requis' })
  }

  // Vérifier que le groupe de notifications existe
  const notificationGroup = await prisma.volunteerNotificationGroup.findFirst({
    where: {
      id: groupId,
      editionId,
    },
  })

  if (!notificationGroup) {
    throw createError({ statusCode: 404, statusMessage: 'Notification introuvable' })
  }

  // Vérifier que l'utilisateur est un bénévole accepté de cette édition
  const volunteerApplication = await prisma.editionVolunteerApplication.findFirst({
    where: {
      editionId,
      userId: event.context.user.id,
      status: 'ACCEPTED',
    },
  })

  if (!volunteerApplication) {
    throw createError({ statusCode: 403, statusMessage: 'Accès non autorisé' })
  }

  // Vérifier si déjà confirmé
  const existingConfirmation = await prisma.volunteerNotificationConfirmation.findFirst({
    where: {
      volunteerNotificationGroupId: groupId,
      userId: event.context.user.id,
    },
  })

  if (existingConfirmation) {
    return {
      success: true,
      alreadyConfirmed: true,
      confirmedAt: existingConfirmation.confirmedAt,
    }
  }

  // Créer la confirmation
  const confirmation = await prisma.volunteerNotificationConfirmation.create({
    data: {
      volunteerNotificationGroupId: groupId,
      userId: event.context.user.id,
    },
  })

  return {
    success: true,
    alreadyConfirmed: false,
    confirmedAt: confirmation.confirmedAt,
  }
})
