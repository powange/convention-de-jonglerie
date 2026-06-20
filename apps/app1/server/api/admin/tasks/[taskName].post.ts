import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    const user = await requireGlobalAdminWithDbCheck(event)

    const taskName = getRouterParam(event, 'taskName')

    // Liste des tâches disponibles
    const availableTasks = [
      'volunteer-reminders',
      'convention-favorites-reminders',
      'cleanup-expired-tokens',
      'cleanup-resolved-error-logs',
      'cleanup-inactive-subscriptions',
    ]

    if (!taskName || !availableTasks.includes(taskName)) {
      throw createError({
        status: 400,
        message: `Tâche invalide. Tâches disponibles: ${availableTasks.join(', ')}`,
      })
    }

    // Audit log : exécution de tâche admin (sans email pour éviter de logger des données sensibles)
    console.log(`🚀 Exécution manuelle de la tâche: ${taskName} par user #${user.id}`)

    const startTime = Date.now()
    const result = await runTask(taskName)
    const executionTime = Date.now() - startTime

    console.log(`✅ Tâche ${taskName} terminée en ${executionTime}ms`)

    return createSuccessResponse({
      taskName,
      executedBy: {
        id: user.id,
        pseudo: user.pseudo,
        email: user.email,
      },
      executionTime: `${executionTime}ms`,
      result,
      timestamp: new Date().toISOString(),
    })
  },
  { operationName: 'ExecuteAdminTask' }
)
