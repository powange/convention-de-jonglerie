import { requireGlobalAdminWithDbCheck } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

/**
 * API Admin - Statistiques des notifications
 * GET /api/admin/notifications/stats
 *
 * Retourne les statistiques des notifications pour le tableau de bord admin
 */
export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  await requireGlobalAdminWithDbCheck(event)

  try {
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

    // Compter les notifications push actives
    const pushSubscriptionsActive = await prisma.pushSubscription.count({
      where: {
        isActive: true,
      },
    })

    return {
      totalSent,
      unreadCount,
      thisWeekCount,
      pushSubscriptionsActive,
    }
  } catch (error) {
    console.error('[Admin] Erreur récupération statistiques notifications:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des statistiques',
    })
  }
})
