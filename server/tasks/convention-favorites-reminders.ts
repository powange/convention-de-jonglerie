export default defineTask({
  meta: {
    name: 'convention-favorites-reminders',
    description: 'Notify users about favorite conventions starting in 3 days',
  },
  async run({ payload: _payload }) {
    try {
      const now = new Date()
      // Fenêtre de notification : entre 2.5 et 3.5 jours pour éviter les doublons
      const notificationStart = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000)
      const notificationEnd = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000)

      // Trouver toutes les éditions qui commencent dans cette fenêtre
      const upcomingEditions = await prisma.edition.findMany({
        where: {
          startDate: { gte: notificationStart, lte: notificationEnd },
        },
        include: {
          convention: { select: { id: true, name: true, logo: true } },
          favoritedBy: { select: { id: true, email: true, pseudo: true, nom: true, prenom: true } },
        },
      })

      let totalNotificationsSent = 0

      // Traiter chaque édition
      for (const edition of upcomingEditions) {
        if (edition.favoritedBy.length > 0) {
          for (const _user of edition.favoritedBy) {
            // TODO: Intégrer avec le système de notifications
            totalNotificationsSent++
          }
        }
      }

      console.log(
        `[CRON convention-favorites-reminders] ${upcomingEditions.length} éditions, ${totalNotificationsSent} notifications`
      )

      return {
        result: {
          success: true,
          editionsProcessed: upcomingEditions.length,
          notificationsSent: totalNotificationsSent,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      console.error('[CRON convention-favorites-reminders] Erreur:', error)
      throw error
    }
  },
})
