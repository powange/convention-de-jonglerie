import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    const session = await requireUserSession(event)
    const userId = session.user.id
    const body = await readBody(event)
    const endpoint = body?.endpoint

    try {
      // Vérifier VAPID subscription si un endpoint est fourni
      let vapidActive = false
      if (endpoint) {
        const subscription = await prisma.pushSubscription.findFirst({
          where: {
            userId,
            endpoint,
            isActive: true,
          },
        })
        vapidActive = !!subscription
      }

      // Vérifier FCM token (au moins un token actif)
      const fcmTokenCount = await prisma.fcmToken.count({
        where: {
          userId,
          isActive: true,
        },
      })
      const fcmActive = fcmTokenCount > 0

      // Actif si au moins un des deux systèmes est actif
      return {
        isActive: vapidActive || fcmActive,
        details: {
          vapid: vapidActive,
          fcm: fcmActive,
        },
      }
    } catch (error) {
      console.error('[Push Check] Erreur lors de la vérification:', error)
      // En cas d'erreur, on retourne false par sécurité
      return {
        isActive: false,
        details: {
          vapid: false,
          fcm: false,
        },
      }
    }
  },
  { operationName: 'CheckPushSubscription' }
)
