import { wrapApiHandler, createPaginatedResponse } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { NotificationService } from '@@/server/utils/notification-service'
import { z } from 'zod'

const querySchema = z.object({
  isRead: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  category: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const query = getQuery(event)
    const parsed = querySchema.parse(query)

    const notifications = await NotificationService.getForUser({
      userId: user.id,
      isRead: parsed.isRead,
      category: parsed.category,
      limit: parsed.limit || 50,
      offset: parsed.offset || 0,
    })

    // Mapper les notifications pour retirer l'email (emailHash déjà présent)
    const mappedNotifications = notifications.map((notification) => ({
      ...notification,
      user: {
        id: notification.user.id,
        pseudo: notification.user.pseudo,
        emailHash: notification.user.emailHash,
        profilePicture: notification.user.profilePicture,
      },
    }))

    // Obtenir aussi le nombre total de notifications non lues
    const unreadCount = await NotificationService.getUnreadCount(user.id, parsed.category)

    // Calculer la page à partir de l'offset et du limit pour createPaginatedResponse
    const limit = parsed.limit || 50
    const offset = parsed.offset || 0
    const page = Math.floor(offset / limit) + 1

    // Obtenir le total pour la pagination (approximatif avec hasMore)
    const total = offset + notifications.length + (notifications.length === limit ? limit : 0)

    return {
      ...createPaginatedResponse(mappedNotifications, total, page, limit),
      unreadCount,
    }
  },
  { operationName: 'GetUserNotifications' }
)
