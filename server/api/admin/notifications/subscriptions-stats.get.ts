import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'

/**
 * GET /api/admin/notifications/subscriptions-stats
 * Statistiques des abonnements push (VAPID et FCM)
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin
    await requireGlobalAdminWithDbCheck(event)

    // Obtenir l'userId depuis la query si fourni
    const query = getQuery(event)
    const userId = query.userId ? Number(query.userId) : undefined

    // Statistiques VAPID
    const [totalVapid, activeVapid, inactiveVapid] = await Promise.all([
      prisma.pushSubscription.count(userId ? { where: { userId } } : undefined),
      prisma.pushSubscription.count({
        where: { isActive: true, ...(userId && { userId }) },
      }),
      prisma.pushSubscription.count({
        where: { isActive: false, ...(userId && { userId }) },
      }),
    ])

    // Statistiques FCM
    const [totalFcm, activeFcm, inactiveFcm] = await Promise.all([
      prisma.fcmToken.count(userId ? { where: { userId } } : undefined),
      prisma.fcmToken.count({
        where: { isActive: true, ...(userId && { userId }) },
      }),
      prisma.fcmToken.count({
        where: { isActive: false, ...(userId && { userId }) },
      }),
    ])

    // Détails des subscriptions si userId fourni
    let userSubscriptions = null
    if (userId) {
      const [vapidSubs, fcmTokens] = await Promise.all([
        prisma.pushSubscription.findMany({
          where: { userId },
          select: {
            id: true,
            isActive: true,
            endpoint: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.fcmToken.findMany({
          where: { userId },
          select: {
            id: true,
            isActive: true,
            token: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ])

      userSubscriptions = {
        vapid: vapidSubs.map((sub) => ({
          ...sub,
          endpoint: sub.endpoint.substring(0, 60) + '...',
        })),
        fcm: fcmTokens.map((token) => ({
          ...token,
          token: token.token.substring(0, 30) + '...',
        })),
      }
    }

    return {
      success: true,
      data: {
        vapid: {
          total: totalVapid,
          active: activeVapid,
          inactive: inactiveVapid,
        },
        fcm: {
          total: totalFcm,
          active: activeFcm,
          inactive: inactiveFcm,
        },
        ...(userSubscriptions && { userSubscriptions }),
      },
    }
  },
  { operationName: 'GetSubscriptionsStats' }
)
