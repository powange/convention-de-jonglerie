import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

/**
 * POST /api/notifications/fcm/subscribe
 * Enregistre un token FCM pour les notifications push
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const { token, deviceId } = await readBody(event)

    if (!token || typeof token !== 'string') {
      throw createError({
        status: 400,
        message: 'Token FCM requis',
      })
    }

    const userAgent = getHeader(event, 'user-agent') || null

    await prisma.fcmToken.upsert({
      where: {
        userId_token: {
          userId: user.id,
          token,
        },
      },
      update: {
        isActive: true,
        deviceId: deviceId || undefined,
        userAgent,
      },
      create: {
        userId: user.id,
        token,
        isActive: true,
        deviceId: deviceId || null,
        userAgent,
      },
    })

    return createSuccessResponse(null, 'Token FCM enregistré')
  },
  { operationName: 'SubscribeFcm' }
)
