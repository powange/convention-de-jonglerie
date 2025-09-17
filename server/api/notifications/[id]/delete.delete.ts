import { requireUserSession } from '#imports'

import { NotificationService } from '../../../utils/notification-service'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const { user } = await requireUserSession(event)

  if (!user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

  const notificationId = getRouterParam(event, 'id')

  if (!notificationId) {
    throw createError({
      statusCode: 400,
      message: 'ID de notification requis',
    })
  }

  try {
    await NotificationService.delete(notificationId, user.id)

    return {
      success: true,
      message: 'Notification supprimée',
    }
  } catch (error) {
    // Vérifier si c'est une erreur de permission (notification non trouvée)
    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        message: 'Notification non trouvée ou accès refusé',
      })
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la suppression de la notification',
    })
  }
})
