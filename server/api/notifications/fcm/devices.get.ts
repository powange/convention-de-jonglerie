import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

/**
 * GET /api/notifications/fcm/devices
 * Liste tous les appareils enregistrés pour les notifications push de l'utilisateur
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const devices = await prisma.fcmToken.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      select: {
        id: true,
        deviceId: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return createSuccessResponse(devices)
  },
  { operationName: 'ListFcmDevices' }
)
