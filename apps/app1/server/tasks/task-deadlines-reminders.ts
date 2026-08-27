import { NotificationHelpers, safeNotify } from '../utils/notification-service'
import {
  PALIERS,
  palierDeRappel,
  typeDeNotification,
  TYPES_DE_RAPPEL,
} from '../utils/rappels-echeance'

/**
 * Tâche planifiée : rappels d'échéance sur les tâches d'édition.
 *
 * Pour les tâches non terminées (statut TODO ou IN_PROGRESS), envoie un rappel à chaque assigné
 * à QUATRE paliers : J-7, J-3, J-1 et le jour même.
 *
 * Un seul palier auparavant, J-1, soit un préavis de trente-neuf heures au plus. Pour une tâche
 * d'organisation — réserver une salle, commander du matériel — c'était trop tard pour agir.
 * Demandé par les organisateurs.
 *
 * Les paliers sont des jours PLEINS, pas des écarts d'horloge : une échéance demain à 8 h et une
 * autre demain à 23 h sont toutes deux « J-1 ». Comparer des instants aurait fait dépendre le
 * palier de l'heure du cron.
 *
 * Les jours intermédiaires — J-6 à J-4, J-2 — n'envoient rien : ils seront couverts par le
 * palier suivant. Notifier chaque jour transformerait le rappel en bruit, et un rappel qu'on
 * ignore ne sert plus à rien.
 *
 * La déduplication s'appuie sur la table Notification : le `notificationType` porte le palier,
 * si bien qu'un même utilisateur reçoit chaque palier au plus une fois par tâche.
 */
export default defineTask({
  meta: {
    name: 'task-deadlines-reminders',
    description: 'Send deadline reminders (J-7, J-3, J-1, J) for non-completed tasks',
  },
  async run() {
    try {
      // Début de la journée courante en heure serveur, et fin du septième jour : la fenêtre
      // couvre le palier le plus lointain.
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const fenetreFin = new Date(todayStart)
      fenetreFin.setDate(fenetreFin.getDate() + PALIERS[0])
      fenetreFin.setHours(23, 59, 59, 999)

      const tasks = await prisma.task.findMany({
        where: {
          status: { in: ['TODO', 'IN_PROGRESS'] },
          deadline: { gte: todayStart, lte: fenetreFin },
        },
        include: {
          group: {
            select: {
              edition: {
                select: { id: true, name: true, convention: { select: { name: true } } },
              },
            },
          },
          assignments: { select: { userId: true } },
        },
      })

      if (tasks.length === 0) {
        console.log('[CRON task-deadlines-reminders] Aucune tâche à examiner')
        return {
          success: true,
          tasksProcessed: 0,
          notificationsSent: 0,
          timestamp: new Date().toISOString(),
        }
      }

      // Une seule query pour récupérer toutes les notifications déjà envoyées
      // pour les tâches concernées (dédup via la table Notification existante).
      const taskIds = tasks.map((t) => t.id.toString())
      const existingNotifications = await prisma.notification.findMany({
        where: {
          entityType: 'Task',
          entityId: { in: taskIds },
          notificationType: { in: TYPES_DE_RAPPEL },
        },
        select: { userId: true, entityId: true, notificationType: true },
      })
      const alreadyNotified = new Set(
        existingNotifications.map((n) => `${n.userId}:${n.entityId}:${n.notificationType}`)
      )

      let notificationsSent = 0

      for (const task of tasks) {
        if (!task.deadline) continue

        // Seuls les quatre paliers notifient : une échéance à J-5 attendra J-3.
        const kind = palierDeRappel(task.deadline, todayStart)
        if (!kind) continue

        const notificationType = typeDeNotification(kind)

        const editionId = task.group.edition.id
        const editionName =
          task.group.edition.name || task.group.edition.convention.name || `Édition #${editionId}`

        for (const a of task.assignments) {
          const key = `${a.userId}:${task.id}:${notificationType}`
          if (alreadyNotified.has(key)) continue

          await safeNotify(
            () =>
              NotificationHelpers.taskDeadlineReminder(
                a.userId,
                task.title,
                editionName,
                editionId,
                task.id,
                kind
              ),
            'task deadline reminder'
          )
          // Marque la combinaison comme notifiée pour la suite de la boucle
          // (au cas où plusieurs tâches partagent un même assigné — sécurité).
          alreadyNotified.add(key)
          notificationsSent++
        }
      }

      console.log(
        `[CRON task-deadlines-reminders] ${tasks.length} tâche(s) examinée(s), ${notificationsSent} notification(s) envoyée(s)`
      )

      return {
        success: true,
        tasksProcessed: tasks.length,
        notificationsSent,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('[CRON task-deadlines-reminders] Erreur:', error)
      throw error
    }
  },
})
