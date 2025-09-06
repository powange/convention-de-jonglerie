import { z } from 'zod'

import { prisma } from '../../utils/prisma'

const bodySchema = z.object({
  endpoint: z.string().url().optional(),
  subscriptionId: z.string().optional(),
}).refine(data => data.endpoint || data.subscriptionId, {
  message: "Il faut soit 'endpoint' soit 'subscriptionId'",
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  const body = await readBody(event)
  const parsed = bodySchema.parse(body)

  try {
    const whereClause: any = {
      userId: event.context.user.id,
    }

    if (parsed.subscriptionId) {
      whereClause.id = parsed.subscriptionId
    } else if (parsed.endpoint) {
      // Chercher par endpoint dans le JSON de subscription
      const subscriptions = await prisma.pushSubscription.findMany({
        where: {
          userId: event.context.user.id,
          active: true,
        },
      })

      const matchingSubscription = subscriptions.find(sub => {
        const subscriptionData = JSON.parse(sub.subscription)
        return subscriptionData.endpoint === parsed.endpoint
      })

      if (!matchingSubscription) {
        return { success: true, message: 'Subscription non trouvée' }
      }

      whereClause.id = matchingSubscription.id
    }

    const result = await prisma.pushSubscription.updateMany({
      where: whereClause,
      data: { active: false },
    })

    return { 
      success: true, 
      message: `${result.count} subscription(s) désactivée(s)` 
    }
  } catch (error) {
    console.error('Erreur lors de la désactivation de la subscription push:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la désactivation des notifications push',
    })
  }
})