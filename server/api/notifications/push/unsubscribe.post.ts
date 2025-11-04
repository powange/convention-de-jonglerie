import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const unsubscribeSchema = z.object({
  endpoint: z.string(),
})

export default wrapApiHandler(
  async (event) => {
    const session = await requireUserSession(event)
    const userId = session.user.id

    const body = await readBody(event)
    const { endpoint } = unsubscribeSchema.parse(body)

    console.log("[Push Unsubscribe] Désactivation de la souscription pour l'utilisateur:", userId)
    console.log('[Push Unsubscribe] Endpoint:', endpoint)

    // Marquer la subscription comme inactive au lieu de la supprimer
    const updated = await prisma.pushSubscription.updateMany({
      where: {
        userId,
        endpoint,
      },
      data: {
        isActive: false,
      },
    })

    console.log('[Push Unsubscribe] Résultat update:', { count: updated.count })

    if (updated.count === 0) {
      console.log('[Push Unsubscribe] ⚠️ Aucune subscription trouvée pour cet endpoint')
      return {
        success: false,
        message: 'Subscription non trouvée',
      }
    }

    console.log('[Push Unsubscribe] ✅ Subscription désactivée avec succès en BDD')
    return {
      success: true,
      message: 'Subscription désactivée',
    }
  },
  { operationName: 'UnsubscribeFromPushNotifications' }
)
