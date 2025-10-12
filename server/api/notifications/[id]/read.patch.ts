import { requireAuth } from '@@/server/utils/auth-utils'
import { NotificationService } from '@@/server/utils/notification-service'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  const notificationId = getRouterParam(event, 'id')

  if (!notificationId) {
    throw createError({
      statusCode: 400,
      message: 'ID de notification requis',
    })
  }

  try {
    const notification = await NotificationService.markAsRead(notificationId, user.id)

    return {
      success: true,
      message: 'Notification marquée comme lue',
      notification,
    }
  } catch (error: any) {
    // Vérifier si c'est une erreur de permission (notification non trouvée)
    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        message: 'Notification non trouvée ou accès refusé',
      })
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la mise à jour de la notification',
    })
  }
})
