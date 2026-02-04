import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

/**
 * GET /api/notifications/fcm/check?deviceId=xxx
 * Vérifie si l'appareil actuel a un token FCM actif (basé sur le deviceId)
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const query = getQuery(event)
    const deviceId = query.deviceId as string | undefined

    // Vérifier si cet appareil spécifique a un token FCM actif
    const deviceToken = deviceId
      ? await prisma.fcmToken.findFirst({
          where: {
            userId: user.id,
            isActive: true,
            deviceId: deviceId,
          },
        })
      : null

    // Compter aussi le nombre total de tokens actifs (pour info)
    const activeTokenCount = await prisma.fcmToken.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    })

    return {
      hasActiveToken: !!deviceToken,
      tokenCount: activeTokenCount,
    }
  },
  { operationName: 'CheckFcmToken' }
)
