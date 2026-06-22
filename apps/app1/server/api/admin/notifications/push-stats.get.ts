import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { unifiedPushService } from '#server/utils/unified-push-service'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    // Obtenir les stats du service FCM
    const serviceStats = await unifiedPushService.getStats()

    // Obtenir des stats détaillées depuis la DB
    const [totalTokens, uniqueUsers, recentTokens] = await Promise.all([
      prisma.fcmToken.count(),
      prisma.fcmToken.groupBy({
        by: ['userId'],
        _count: true,
      }),
      prisma.fcmToken.findMany({
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

    // Calculer les tokens par jour sur les 7 derniers jours
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const tokensByDay = await prisma.fcmToken.groupBy({
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
      totalTokens,
      uniqueUsers: uniqueUsers.length,
      recentTokens: recentTokens.map((token) => ({
        id: token.id,
        userId: token.userId,
        isActive: token.isActive,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        user: token.user,
        token: token.token.substring(0, 30) + '...',
      })),
      tokensByDay: tokensByDay.map((day) => ({
        date: day.createdAt,
        count: day._count,
      })),
    }
  },
  { operationName: 'GetPushNotificationStats' }
)
