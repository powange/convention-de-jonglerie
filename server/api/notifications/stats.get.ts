import { requireAuth } from '@@/server/utils/auth-utils'
import { NotificationService } from '@@/server/utils/notification-service'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  try {
    const stats = await NotificationService.getStats(user.id)

    return {
      success: true,
      stats,
    }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des statistiques',
    })
  }
})
