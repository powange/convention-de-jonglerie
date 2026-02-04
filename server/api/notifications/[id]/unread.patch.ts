import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { NotificationService } from '@@/server/utils/notification-service'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const notificationId = getRouterParam(event, 'id')

    if (!notificationId) {
      throw createError({
        status: 400,
        message: 'ID de notification requis',
      })
    }

    try {
      const notification = await NotificationService.markAsUnread(notificationId, user.id)

      return {
        success: true,
        message: 'Notification marquée comme non lue',
        notification,
      }
    } catch (error: unknown) {
      // Vérifier si c'est une erreur de permission (notification non trouvée)
      if (error.code === 'P2025') {
        throw createError({
          status: 404,
          message: 'Notification non trouvée ou accès refusé',
        })
      }
      throw error
    }
  },
  { operationName: 'MarkNotificationAsUnread' }
)
