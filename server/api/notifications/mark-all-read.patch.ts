import { z } from 'zod'

import { requireAuth } from '../../utils/auth-utils'
import { NotificationService } from '../../utils/notification-service'

const bodySchema = z.object({
  category: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  const body = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.parse(body)

  try {
    const result = await NotificationService.markAllAsRead(user.id, parsed.category)

    return {
      success: true,
      message: `${result.count} notification${result.count > 1 ? 's' : ''} marquée${result.count > 1 ? 's' : ''} comme lue${result.count > 1 ? 's' : ''}`,
      updatedCount: result.count,
    }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la mise à jour des notifications',
    })
  }
})
