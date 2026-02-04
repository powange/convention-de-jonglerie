import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationService } from '#server/utils/notification-service'

const bodySchema = z.object({
  category: z.string().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const body = await readBody(event).catch(() => ({}))
    const parsed = bodySchema.parse(body)
    const result = await NotificationService.markAllAsRead(user.id, parsed.category)

    return {
      success: true,
      message: `${result.count} notification${result.count > 1 ? 's' : ''} marquée${result.count > 1 ? 's' : ''} comme lue${result.count > 1 ? 's' : ''}`,
      updatedCount: result.count,
    }
  },
  { operationName: 'MarkAllNotificationsAsRead' }
)
