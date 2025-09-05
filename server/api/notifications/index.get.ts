import { z } from 'zod'

import { requireUserSession } from '#imports'

import { NotificationService } from '../../utils/notification-service'

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
  const { user } = await requireUserSession(event)

  if (!user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    })
  }

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

    // Obtenir aussi le nombre total de notifications non lues
    const unreadCount = await NotificationService.getUnreadCount(user.id, parsed.category)

    return {
      success: true,
      notifications,
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
      statusMessage: 'Erreur lors de la récupération des notifications',
    })
  }
})
