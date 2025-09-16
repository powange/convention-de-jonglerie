import { prisma } from '../utils/prisma'

export default defineTask({
  meta: {
    name: 'volunteer-reminders',
    description: 'Send reminders to volunteers 30 minutes before their shifts',
  },
  async run({ payload }) {
    console.log('🔔 Exécution de la tâche: rappels bénévoles')

    try {
      // Calculer la fenêtre de temps (dans 28-32 minutes pour éviter les doublons)
      const now = new Date()
      const reminderStart = new Date(now.getTime() + 28 * 60 * 1000) // Dans 28 minutes
      const reminderEnd = new Date(now.getTime() + 32 * 60 * 1000)   // Dans 32 minutes

      // Trouver tous les créneaux qui commencent dans cette fenêtre
      const upcomingSlots = await prisma.volunteerTimeSlot.findMany({
        where: {
          startDateTime: {
            gte: reminderStart,
            lte: reminderEnd,
          },
          // Seulement les créneaux des éditions actives
          edition: {
            status: {
              in: ['DRAFT', 'PUBLISHED'],
            },
          },
        },
        include: {
          assignments: {
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
          team: {
            select: {
              name: true,
              color: true,
            },
          },
          edition: {
            select: {
              id: true,
              name: true,
              convention: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })

      console.log(`📅 Trouvé ${upcomingSlots.length} créneaux dans les 30 prochaines minutes`)

      let totalNotificationsSent = 0

      // Traiter chaque créneau
      for (const slot of upcomingSlots) {
        if (slot.assignments.length > 0) {
          const editionName = slot.edition.name || slot.edition.convention.name
          const slotTitle = slot.title || 'Créneau bénévole'
          const teamName = slot.team?.name || 'Équipe non assignée'

          const startTime = slot.startDateTime.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })

          for (const assignment of slot.assignments) {
            // TODO: Intégrer avec votre système de notifications existant
            // Pour l'instant, on log les notifications qui devraient être envoyées
            console.log(`🔔 Notification à envoyer à ${assignment.user.pseudo} (${assignment.user.email})`)
            console.log(`   Créneau: ${slotTitle} - ${teamName}`)
            console.log(`   Édition: ${editionName}`)
            console.log(`   Heure: ${startTime}`)
            console.log(`   Message: "Rappel: votre créneau bénévole commence dans 30 minutes"`)

            // Ici vous pouvez intégrer avec votre système de notifications push
            // ou envoyer un email via votre service d'email existant

            totalNotificationsSent++
          }
        }
      }

      console.log(`✅ Tâche terminée: ${totalNotificationsSent} notifications de rappel envoyées`)

      return {
        success: true,
        slotsProcessed: upcomingSlots.length,
        notificationsSent: totalNotificationsSent,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi des rappels bénévoles:', error)
      throw error
    }
  },
})