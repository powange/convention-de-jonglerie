import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'

/**
 * API Admin - Statistiques des notifications
 * GET /api/admin/notifications/stats
 *
 * Retourne les statistiques des notifications pour le tableau de bord admin
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    // Compter le total des notifications
    const totalSent = await prisma.notification.count()

    // Compter les notifications non lues
    const unreadCount = await prisma.notification.count({
      where: {
        isRead: false,
      },
    })

    // Compter les notifications de cette semaine
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const thisWeekCount = await prisma.notification.count({
      where: {
        createdAt: {
          gte: oneWeekAgo,
        },
      },
    })

    // Compter les tokens FCM actifs
    const fcmTokensActive = await prisma.fcmToken.count({
      where: {
        isActive: true,
      },
    })

    return {
      totalSent,
      unreadCount,
      thisWeekCount,
      fcmTokensActive,
    }
  },
  { operationName: 'GetNotificationStats' }
)
