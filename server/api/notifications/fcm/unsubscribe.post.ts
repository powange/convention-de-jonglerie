import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

/**
 * POST /api/notifications/fcm/unsubscribe
 * Désactive un ou tous les tokens FCM de l'utilisateur
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event).catch(() => ({}))
    const { token } = body || {}

    let result

    if (token && typeof token === 'string') {
      result = await prisma.fcmToken.updateMany({
        where: {
          userId: user.id,
          token,
        },
        data: {
          isActive: false,
        },
      })
    } else {
      result = await prisma.fcmToken.updateMany({
        where: {
          userId: user.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })
    }

    return createSuccessResponse({ count: result.count }, 'Token(s) FCM désactivé(s)')
  },
  { operationName: 'UnsubscribeFcm' }
)
