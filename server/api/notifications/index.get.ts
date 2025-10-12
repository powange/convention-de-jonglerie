import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
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

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  const query = getQuery(event)
  const parsed = querySchema.parse(query)

  try {
    const notifications = await NotificationService.getForUser({
      userId: user.id,
      isRead: parsed.isRead,
      category: parsed.category,
      limit: parsed.limit || 50,
      offset: parsed.offset || 0,
    })

    // Mapper les notifications pour ajouter emailHash et retirer l'email
    const mappedNotifications = notifications.map((notification) => ({
      ...notification,
      user: {
        id: notification.user.id,
        pseudo: notification.user.pseudo,
        emailHash: getEmailHash(notification.user.email),
      },
    }))

    // Obtenir aussi le nombre total de notifications non lues
    const unreadCount = await NotificationService.getUnreadCount(user.id, parsed.category)

    return {
      success: true,
      notifications: mappedNotifications,
      unreadCount,
      pagination: {
        limit: parsed.limit || 50,
        offset: parsed.offset || 0,
        hasMore: notifications.length === (parsed.limit || 50),
      },
    }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des notifications',
    })
  }
})
