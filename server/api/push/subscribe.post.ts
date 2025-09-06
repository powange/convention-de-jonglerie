import { z } from 'zod'

import { prisma } from '../../utils/prisma'

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

const bodySchema = z.object({
  subscription: subscriptionSchema,
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  const body = await readBody(event)
  const parsed = bodySchema.parse(body)
  const userAgent = getHeader(event, 'user-agent') || null

  try {
    // Vérifier si cette subscription existe déjà
    const existingSubscription = await prisma.pushSubscription.findFirst({
      where: {
        userId: event.context.user.id,
        subscription: JSON.stringify(parsed.subscription),
      },
    })

    if (existingSubscription) {
      // Réactiver si elle était désactivée
      if (!existingSubscription.active) {
        await prisma.pushSubscription.update({
          where: { id: existingSubscription.id },
          data: { active: true },
        })
      }
      return { success: true, message: 'Subscription mise à jour' }
    }

    // Créer nouvelle subscription
    const subscription = await prisma.pushSubscription.create({
      data: {
        userId: event.context.user.id,
        subscription: JSON.stringify(parsed.subscription),
        userAgent,
        active: true,
      },
    })

    return { success: true, subscriptionId: subscription.id }
  } catch (error) {
    console.error('Erreur lors de la création de la subscription push:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de l\'enregistrement des notifications push',
    })
  }
})