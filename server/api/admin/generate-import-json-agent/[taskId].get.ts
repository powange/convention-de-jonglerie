import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { getTask } from '@@/server/utils/async-tasks'

import type { AgentGenerateResult } from '../generate-import-json-agent.post'

const DEFAULT_MAX_ITERATIONS = 8

/**
 * GET /api/admin/generate-import-json-agent/[taskId]
 * Récupère le statut et le résultat d'une tâche d'exploration agent
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer le taskId depuis l'URL
    const taskId = getRouterParam(event, 'taskId')

    if (!taskId) {
      throw createError({
        status: 400,
        message: 'taskId manquant',
      })
    }

    // Récupérer la tâche
    const task = getTask<AgentGenerateResult>(taskId)

    if (!task) {
      throw createError({
        status: 404,
        message: 'Tâche non trouvée ou expirée',
      })
    }

    // Retourner le statut et le résultat si disponible
    if (task.status === 'completed' && task.result) {
      return {
        taskId: task.id,
        status: task.status,
        progress: 100,
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

    // Tâche en cours - inclure les métadonnées de progression
    const metadata = task.metadata || {}
    return {
      taskId: task.id,
      status: task.status,
      progress: task.progress || 0,
      pagesVisited: (metadata.pagesVisited as number) || 0,
      currentIteration: (metadata.currentIteration as number) || 0,
      maxIterations: (metadata.maxIterations as number) || DEFAULT_MAX_ITERATIONS,
      message:
        (metadata.statusMessage as string) ||
        (task.status === 'processing'
          ? 'Exploration des pages en cours...'
          : 'En attente de traitement...'),
    }
  },
  { operationName: 'GetGenerateImportJsonAgentStatus' }
)
