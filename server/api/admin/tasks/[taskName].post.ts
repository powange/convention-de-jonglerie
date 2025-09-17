import { requireGlobalAdminWithDbCheck } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  const user = await requireGlobalAdminWithDbCheck(event)

  const taskName = getRouterParam(event, 'taskName')

  // Liste des tâches disponibles
  const availableTasks = [
    'volunteer-reminders',
    'convention-favorites-reminders',
    'cleanup-expired-tokens',
    'cleanup-resolved-error-logs',
  ]

  if (!taskName || !availableTasks.includes(taskName)) {
    throw createError({
      statusCode: 400,
      message: `Tâche invalide. Tâches disponibles: ${availableTasks.join(', ')}`,
    })
  }

  try {
    console.log(`🚀 Exécution manuelle de la tâche: ${taskName} par ${user.pseudo} (${user.email})`)

    const startTime = Date.now()
    const result = await runTask(taskName)
    const executionTime = Date.now() - startTime

    console.log(`✅ Tâche ${taskName} terminée en ${executionTime}ms`)

    return {
      success: true,
      taskName,
      executedBy: {
        id: user.id,
        pseudo: user.pseudo,
        email: user.email,
      },
      executionTime: `${executionTime}ms`,
      result,
      timestamp: new Date().toISOString(),
    }
  } catch (error: any) {
    console.error(`❌ Erreur lors de l'exécution de la tâche ${taskName}:`, error)

    throw createError({
      statusCode: 500,
      message: `Erreur lors de l'exécution de la tâche ${taskName}: ${error.message}`,
    })
  }
})
