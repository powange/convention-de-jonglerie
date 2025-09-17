import { requireUserSession } from '#imports'

import { NotificationService } from '../../utils/notification-service'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const { user } = await requireUserSession(event)

  if (!user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

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
