import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    // Liste des tâches disponibles avec leurs descriptions et planifications
    const tasks = [
      {
        name: 'volunteer-reminders',
        description: 'Envoie des rappels aux bénévoles 30 minutes avant leurs créneaux',
        schedule: 'Chaque minute (vérifie les créneaux dans 30 min)',
        cronExpression: '* * * * *',
        category: 'Notifications',
      },
      {
        name: 'convention-favorites-reminders',
        description:
          'Notifie les utilisateurs des conventions favorites qui commencent dans 3 jours',
        schedule: 'Quotidien à 10h',
        cronExpression: '0 10 * * *',
        category: 'Notifications',
      },
      {
        name: 'cleanup-expired-tokens',
        description: 'Nettoie les tokens de réinitialisation de mot de passe expirés',
        schedule: 'Quotidien à 2h',
        cronExpression: '0 2 * * *',
        category: 'Maintenance',
      },
      {
        name: 'cleanup-resolved-error-logs',
        description: "Supprime les logs d'erreur résolus de plus d'un mois",
        schedule: 'Mensuel (1er du mois à 3h)',
        cronExpression: '0 3 1 * *',
        category: 'Maintenance',
      },
    ]

    return {
      success: true,
      tasks,
      totalTasks: tasks.length,
      cronEnabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true',
      timestamp: new Date().toISOString(),
    }
  },
  { operationName: 'GetAdminTasks' }
)
