import { NotificationService } from '../utils/notification-service'
import { prisma } from '../utils/prisma'

export default defineTask({
  meta: {
    name: 'volunteer-reminders',
    description: 'Send reminders to volunteers 30 minutes before their shifts',
  },
  async run({ payload: _payload }) {
    console.log('🔔 Exécution de la tâche: rappels bénévoles')

    try {
      // Calculer la fenêtre de temps (dans 28-32 minutes pour éviter les doublons)
      const now = new Date()
      const reminderStart = new Date(now.getTime() + 28 * 60 * 1000) // Dans 28 minutes
      const reminderEnd = new Date(now.getTime() + 32 * 60 * 1000) // Dans 32 minutes

      // Trouver tous les créneaux qui commencent dans cette fenêtre
      const upcomingSlots = await prisma.volunteerTimeSlot.findMany({
        where: {
          startDateTime: {
            gte: reminderStart,
            lte: reminderEnd,
          },
          // Seulement les créneaux des éditions futures
          edition: {
            endDate: {
              gte: now, // L'édition n'est pas encore terminée
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
            timeZone: 'Europe/Paris',
          })

          for (const assignment of slot.assignments) {
            try {
              // Créer et envoyer la notification
              await NotificationService.create({
                userId: assignment.user.id,
                type: 'INFO',
                title: 'Rappel : Créneau bénévole dans 30 minutes',
                message: `Votre créneau "${slotTitle}" pour l'équipe "${teamName}" de "${editionName}" commence à ${startTime}. Merci de vous présenter à l'heure !`,
                category: 'volunteer',
                entityType: 'VolunteerTimeSlot',
                entityId: slot.id,
                actionUrl: `/my-volunteer-applications`,
                actionText: 'Voir mes candidatures',
                notificationType: 'volunteer_reminder',
              })

              console.log(
                `✅ Notification envoyée à ${assignment.user.pseudo} pour le créneau ${slotTitle}`
              )
              totalNotificationsSent++
            } catch (error) {
              console.error(
                `❌ Erreur lors de l'envoi de la notification à ${assignment.user.pseudo}:`,
                error
              )
              // On continue avec les autres notifications même si une échoue
            }
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
      console.error("❌ Erreur lors de l'envoi des rappels bénévoles:", error)
      throw error
    }
  },
})
