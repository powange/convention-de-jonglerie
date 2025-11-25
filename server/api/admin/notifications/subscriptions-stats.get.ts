import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'

/**
 * GET /api/admin/notifications/subscriptions-stats
 * Statistiques des abonnements push FCM
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin
    await requireGlobalAdminWithDbCheck(event)

    // Obtenir l'userId depuis la query si fourni
    const query = getQuery(event)
    const userId = query.userId ? Number(query.userId) : undefined

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

    // Détails des tokens si userId fourni
    let userTokens = null
    if (userId) {
      const fcmTokens = await prisma.fcmToken.findMany({
        where: { userId },
        select: {
          id: true,
          isActive: true,
          token: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      userTokens = fcmTokens.map((token) => ({
        ...token,
        token: token.token.substring(0, 30) + '...',
      }))
    }

    return {
      success: true,
      data: {
        fcm: {
          total: totalFcm,
          active: activeFcm,
          inactive: inactiveFcm,
        },
        ...(userTokens && { userTokens }),
      },
    }
  },
  { operationName: 'GetSubscriptionsStats' }
)
