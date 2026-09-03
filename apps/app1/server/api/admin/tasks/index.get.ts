import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { TACHES_PLANIFIEES } from '#server/utils/scheduled-tasks'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    const tasks = TACHES_PLANIFIEES

    return createSuccessResponse({
      tasks,
      totalTasks: tasks.length,
      cronEnabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true',
      timestamp: new Date().toISOString(),
    })
  },
  { operationName: 'GetAdminTasks' }
)
