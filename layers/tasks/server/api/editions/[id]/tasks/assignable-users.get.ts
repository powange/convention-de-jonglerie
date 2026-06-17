import { useTaskboardPorts } from '#server/taskboard/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/tasks/assignable-users
 *
 * Retourne la liste des utilisateurs qui peuvent être assignés à une tâche. La résolution propre au
 * domaine (organisateurs + bénévoles acceptés) est déléguée au port `directory` : le layer ne lit
 * plus les modèles d'autres modules.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const users = await useTaskboardPorts().directory.getAssignableUsers(editionId)

    return createSuccessResponse({ users })
  },
  { operationName: 'GetAssignableUsersForTasks' }
)
