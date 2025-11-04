import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { NotificationService } from '@@/server/utils/notification-service'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const stats = await NotificationService.getStats(user.id)

    return {
      success: true,
      stats,
    }
  },
  { operationName: 'GetNotificationStats' }
)
