import { z } from 'zod'

import { prisma } from '../../../utils/prisma'

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
})

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification
    const session = await requireUserSession(event)
    const userId = session.user.id

    // Valider les données
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
          isActive: true, // Réactiver la subscription
          updatedAt: new Date(),
        },
      })

      return {
        success: true,
        message: 'Subscription mise à jour',
        subscriptionId: updated.id,
      }
    } else {
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
          title: 'Notifications activées',
          message: 'Vous recevrez maintenant des notifications push sur cet appareil',
          type: 'SUCCESS',
          category: 'SYSTEM',
        },
      })

      return {
        success: true,
        message: 'Subscription créée',
        subscriptionId: created.id,
      }
    }
  } catch (error: any) {
    console.error('[Push Subscribe] Erreur:', error)

    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
      })
    }

    throw createError({
      statusCode: 500,
      message: "Erreur lors de l'enregistrement de la subscription",
    })
  }
})
