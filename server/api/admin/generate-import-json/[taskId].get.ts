import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { getTask } from '@@/server/utils/async-tasks'

import type { GenerateImportResult } from '../generate-import-json.post'

/**
 * GET /api/admin/generate-import-json/[taskId]
 * Récupère le statut et le résultat d'une tâche de génération
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer le taskId depuis l'URL
    const taskId = getRouterParam(event, 'taskId')

    if (!taskId) {
      throw createError({
        statusCode: 400,
        message: 'taskId manquant',
      })
    }

    // Récupérer la tâche
    const task = getTask<GenerateImportResult>(taskId)

    if (!task) {
      throw createError({
        statusCode: 404,
        message: 'Tâche non trouvée ou expirée',
      })
    }

    // Retourner le statut et le résultat si disponible
    if (task.status === 'completed' && task.result) {
      return {
        taskId: task.id,
        status: task.status,
        result: task.result,
      }
    }

    if (task.status === 'failed') {
      return {
        taskId: task.id,
        status: task.status,
        error: task.error || 'Erreur inconnue',
      }
    }

    // Tâche en cours
    return {
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      message: task.status === 'processing' ? 'Génération en cours...' : 'En attente...',
    }
  },
  { operationName: 'GetGenerateImportJsonStatus' }
)
