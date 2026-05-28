import { NotificationHelpers, safeNotify } from '../utils/notification-service'

/**
 * Tâche planifiée : rappels d'échéance sur les tâches d'édition.
 *
 * Pour les tâches non terminées (statut TODO ou IN_PROGRESS) dont la deadline
 * tombe aujourd'hui (kind=J) ou demain (kind=J_MINUS_1), envoie une notification
 * à chaque assigné. La déduplication s'appuie sur la table Notification existante :
 * avant d'envoyer un rappel, on vérifie qu'il n'existe pas déjà une notification
 * de même `notificationType` (`task_deadline_reminder_j_minus_1` ou
 * `task_deadline_reminder_j`) pour le couple (userId, taskId). Un même
 * utilisateur ne reçoit donc chaque kind de rappel qu'une seule fois par tâche.
 */
export default defineTask({
  meta: {
    name: 'task-deadlines-reminders',
    description: 'Send deadline reminders (J-1, J) for non-completed tasks',
  },
  async run() {
    try {
      // Bornes de la journée courante et du lendemain en heure serveur.
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const tomorrowStart = new Date(todayStart)
      tomorrowStart.setDate(tomorrowStart.getDate() + 1)
      const tomorrowEnd = new Date(tomorrowStart)
      tomorrowEnd.setHours(23, 59, 59, 999)

      const tasks = await prisma.task.findMany({
        where: {
          status: { in: ['TODO', 'IN_PROGRESS'] },
          deadline: { gte: todayStart, lte: tomorrowEnd },
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
          notificationType: {
            in: ['task_deadline_reminder_j_minus_1', 'task_deadline_reminder_j'],
          },
        },
        select: { userId: true, entityId: true, notificationType: true },
      })
      const alreadyNotified = new Set(
        existingNotifications.map((n) => `${n.userId}:${n.entityId}:${n.notificationType}`)
      )

      let notificationsSent = 0

      for (const task of tasks) {
        if (!task.deadline) continue
        const kind: 'J_MINUS_1' | 'J' = task.deadline >= tomorrowStart ? 'J_MINUS_1' : 'J'
        const notificationType =
          kind === 'J_MINUS_1' ? 'task_deadline_reminder_j_minus_1' : 'task_deadline_reminder_j'

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
