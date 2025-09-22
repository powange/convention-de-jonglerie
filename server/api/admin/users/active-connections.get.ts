import { requireGlobalAdminWithDbCheck } from '../../../utils/admin-auth'
import { notificationStreamManager } from '../../../utils/notification-stream-manager'

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification et les droits admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer les statistiques de connexions SSE
    const stats = notificationStreamManager.getStats()

    // Transformer en liste d'IDs d'utilisateurs connectés pour faciliter l'usage côté client
    const activeUserIds = stats.connectionsByUser.map(connection => connection.userId)

    return {
      activeUserIds,
      totalConnections: stats.totalConnections,
      activeUsers: stats.activeUsers,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des connexions actives:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})