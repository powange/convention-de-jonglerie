import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

const fcmSubscribeSchema = z.object({
  token: z.string().min(1, 'Token FCM requis').max(500),
  deviceId: z.string().max(200).optional(),
})

/**
 * POST /api/notifications/fcm/subscribe
 * Enregistre un token FCM pour les notifications push
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)
    const { token, deviceId } = fcmSubscribeSchema.parse(body)

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
