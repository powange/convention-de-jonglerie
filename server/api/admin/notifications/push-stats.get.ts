import { requireGlobalAdminWithDbCheck } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'
import { pushNotificationService } from '../../../utils/push-notification-service'

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    // Obtenir les stats du service
    const serviceStats = await pushNotificationService.getStats()

    // Obtenir des stats détaillées depuis la DB
    const [totalSubscriptions, uniqueUsers, recentSubscriptions] = await Promise.all([
      prisma.pushSubscription.count(),
      prisma.pushSubscription.groupBy({
        by: ['userId'],
        _count: true,
      }),
      prisma.pushSubscription.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: {
            select: {
              id: true,
              pseudo: true,
              email: true,
            },
          },
        },
      }),
    ])

    // Calculer les abonnements par jour sur les 7 derniers jours
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const subscriptionsByDay = await prisma.pushSubscription.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      _count: true,
    })

    return {
      ...serviceStats,
      totalSubscriptions,
      uniqueUsers: uniqueUsers.length,
      recentSubscriptions,
      subscriptionsByDay: subscriptionsByDay.map((day) => ({
        date: day.createdAt,
        count: day._count,
      })),
    }
  } catch (error: any) {
    console.error('[Push Stats] Erreur:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des statistiques',
    })
  }
})
