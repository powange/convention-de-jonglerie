import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

/**
 * DELETE /api/notifications/fcm/devices/[id]
 * Supprime un appareil enregistré pour les notifications push
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const deviceId = getRouterParam(event, 'id')

    if (!deviceId) {
      throw createError({
        status: 400,
        message: "ID de l'appareil requis",
      })
    }

    // Vérifier que le token appartient à l'utilisateur
    const device = await prisma.fcmToken.findFirst({
      where: {
        id: deviceId,
        userId: user.id,
      },
    })

    if (!device) {
      throw createError({
        status: 404,
        message: 'Appareil non trouvé',
      })
    }

    await prisma.fcmToken.delete({
      where: { id: deviceId },
    })

    return createSuccessResponse(null, 'Appareil supprimé')
  },
  { operationName: 'DeleteFcmDevice' }
)
