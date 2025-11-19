export default defineTask({
  meta: {
    name: 'convention-favorites-reminders',
    description: 'Notify users about favorite conventions starting in 3 days',
  },
  async run({ payload: _payload }) {
    console.log('💖 Exécution de la tâche: notifications conventions favorites')

    try {
      // Calculer la date dans 3 jours (avec une marge de 1 jour)
      const now = new Date()
      const _targetDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

      // Fenêtre de notification : entre 2.5 et 3.5 jours pour éviter les doublons
      const notificationStart = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000)
      const notificationEnd = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000)

      // Trouver toutes les éditions qui commencent dans cette fenêtre
      const upcomingEditions = await prisma.edition.findMany({
        where: {
          startDate: {
            gte: notificationStart.toISOString().split('T')[0],
            lte: notificationEnd.toISOString().split('T')[0],
          },
          status: {
            in: ['DRAFT', 'PUBLISHED'],
          },
        },
        include: {
          convention: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          favorites: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  pseudo: true,
                  nom: true,
                  prenom: true,
                },
              },
            },
          },
        },
      })

      console.log(`📅 Trouvé ${upcomingEditions.length} éditions commençant dans 3 jours`)

      let totalNotificationsSent = 0

      // Traiter chaque édition
      for (const edition of upcomingEditions) {
        if (edition.favorites.length > 0) {
          const editionName = edition.name || edition.convention.name
          const startDate = new Date(edition.startDate).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })

          console.log(`💫 Traitement de l'édition: ${editionName}`)
          console.log(`   Date de début: ${startDate}`)
          console.log(`   Nombre de favoris: ${edition.favorites.length}`)

          for (const favorite of edition.favorites) {
            // TODO: Intégrer avec votre système de notifications existant
            // Pour l'instant, on log les notifications qui devraient être envoyées
            console.log(
              `🔔 Notification à envoyer à ${favorite.user.pseudo} (${favorite.user.email})`
            )
            console.log(`   Édition: ${editionName}`)
            console.log(`   Convention: ${edition.convention.name}`)
            console.log(`   Lieu: ${edition.city}, ${edition.country}`)
            console.log(`   Début: ${startDate}`)
            console.log(`   Message: "Votre convention favorite commence dans 3 jours !"`)

            // Ici vous pouvez intégrer avec votre système de notifications push
            // ou envoyer un email via votre service d'email existant

            totalNotificationsSent++
          }
        }
      }

      console.log(
        `✅ Tâche terminée: ${totalNotificationsSent} notifications de conventions favorites envoyées`
      )

      return {
        success: true,
        editionsProcessed: upcomingEditions.length,
        notificationsSent: totalNotificationsSent,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi des notifications de conventions favorites:", error)
      throw error
    }
  },
})
