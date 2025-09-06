import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId: event.context.user.id,
        active: true,
      },
      select: {
        id: true,
        userAgent: true,
        createdAt: true,
        subscription: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Parser les subscriptions pour extraire des infos utiles
    const enrichedSubscriptions = subscriptions.map(sub => {
      const subscriptionData = JSON.parse(sub.subscription)
      const endpoint = new URL(subscriptionData.endpoint)
      
      // Identifier le service push
      let service = 'Unknown'
      if (endpoint.hostname.includes('fcm.googleapis.com')) {
        service = 'FCM (Android/Chrome)'
      } else if (endpoint.hostname.includes('web.push.apple.com')) {
        service = 'Apple Push (Safari)'
      } else if (endpoint.hostname.includes('updates.push.services.mozilla.com')) {
        service = 'Mozilla Push (Firefox)'
      }

      return {
        id: sub.id,
        service,
        userAgent: sub.userAgent,
        createdAt: sub.createdAt,
        endpoint: subscriptionData.endpoint,
      }
    })

    return {
      success: true,
      subscriptions: enrichedSubscriptions,
      count: subscriptions.length,
      hasActiveSubscriptions: subscriptions.length > 0,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du statut push:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération du statut des notifications push',
    })
  }
})