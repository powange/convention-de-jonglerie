import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const taskId = Number(getRouterParam(event, 'taskId'))
    if (isNaN(taskId)) {
      throw createError({ status: 400, message: 'Identifiant de tâche invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const existing = await prisma.task.findFirst({
      where: { id: taskId, group: { editionId } },
      select: { id: true },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Tâche introuvable' })
    }

    await prisma.task.delete({ where: { id: taskId } })

    return createSuccessResponse({ success: true })
  },
  { operationName: 'DeleteTask' }
)
