import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { z } from 'zod'

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
})

export default wrapApiHandler(
  async (event) => {
    const session = await requireUserSession(event)
    const userId = session.user.id

    const body = await readBody(event)
    const { subscription } = subscriptionSchema.parse(body)

    console.log("[Push Subscribe] Nouvelle souscription pour l'utilisateur:", userId)

    // Vérifier si une subscription existe déjà
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: {
        userId_endpoint: {
          userId,
          endpoint: subscription.endpoint,
        },
      },
    })

    if (existingSubscription) {
      console.log('[Push Subscribe] Mise à jour de la souscription existante')
      // Mettre à jour la subscription existante et la réactiver
      const updated = await prisma.pushSubscription.update({
        where: {
          id: existingSubscription.id,
        },
        data: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          isActive: true,
          updatedAt: new Date(),
        },
      })

      return {
        success: true,
        message: 'Subscription mise à jour',
        subscriptionId: updated.id,
      }
    }

    console.log("[Push Subscribe] Création d'une nouvelle souscription")
    // Créer une nouvelle subscription
    const created = await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    })

    // Créer une notification de bienvenue
    await prisma.notification.create({
      data: {
        userId,
        titleText: 'Notifications activées',
        messageText: 'Vous recevrez maintenant des notifications push sur cet appareil',
        type: 'SUCCESS',
        category: 'SYSTEM',
      },
    })

    return {
      success: true,
      message: 'Subscription créée',
      subscriptionId: created.id,
    }
  },
  { operationName: 'SubscribeToPushNotifications' }
)
