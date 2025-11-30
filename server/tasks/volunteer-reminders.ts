import { NotificationService } from '../utils/notification-service'

export default defineTask({
  meta: {
    name: 'volunteer-reminders',
    description: 'Send reminders to volunteers 30 minutes before their shifts',
  },
  async run({ payload: _payload }) {
    try {
      // Calculer la fenêtre de temps (dans 28-32 minutes pour éviter les doublons)
      const now = new Date()
      const reminderStart = new Date(now.getTime() + 28 * 60 * 1000) // Dans 28 minutes
      const reminderEnd = new Date(now.getTime() + 32 * 60 * 1000) // Dans 32 minutes

      // Récupérer tous les créneaux des éditions en cours
      const allSlots = await prisma.volunteerTimeSlot.findMany({
        where: {
          edition: {
            endDate: { gte: now },
          },
        },
        include: {
          assignments: {
            include: {
              user: {
                select: { id: true, email: true, pseudo: true, nom: true, prenom: true },
              },
            },
          },
          team: { select: { name: true, color: true } },
          edition: {
            select: { id: true, name: true, convention: { select: { name: true } } },
          },
        },
      })

      // Filtrer manuellement en tenant compte du delayMinutes
      const upcomingSlots = allSlots.filter((slot) => {
        const delay = slot.delayMinutes || 0
        const adjustedStart = new Date(slot.startDateTime.getTime() + delay * 60 * 1000)
        return adjustedStart >= reminderStart && adjustedStart <= reminderEnd
      })

      let totalNotificationsSent = 0

      // Traiter chaque créneau
      for (const slot of upcomingSlots) {
        if (slot.assignments.length > 0) {
          const editionName = slot.edition.name || slot.edition.convention.name
          const slotTitle = slot.title || 'Créneau bénévole'
          const teamName = slot.team?.name || 'Équipe non assignée'
          const delay = slot.delayMinutes || 0
          const adjustedStartDateTime = new Date(slot.startDateTime.getTime() + delay * 60 * 1000)
          const startTime = adjustedStartDateTime.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Paris',
          })

          for (const assignment of slot.assignments) {
            try {
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
              totalNotificationsSent++
            } catch (error) {
              console.error(
                `[CRON volunteer-reminders] Erreur notification ${assignment.user.pseudo}:`,
                error
              )
            }
          }
        }
      }

      console.log(
        `[CRON volunteer-reminders] ${upcomingSlots.length} créneaux, ${totalNotificationsSent} notifications`
      )

      return {
        success: true,
        slotsProcessed: upcomingSlots.length,
        notificationsSent: totalNotificationsSent,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('[CRON volunteer-reminders] Erreur:', error)
      throw error
    }
  },
})
