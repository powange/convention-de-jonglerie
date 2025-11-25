import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'

/**
 * GET /api/notifications/fcm/check
 * Vérifie si l'utilisateur a un token FCM actif
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Vérifier si l'utilisateur a au moins un token FCM actif
    const activeTokenCount = await prisma.fcmToken.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    })

    return {
      hasActiveToken: activeTokenCount > 0,
      tokenCount: activeTokenCount,
    }
  },
  { operationName: 'CheckFcmToken' }
)
