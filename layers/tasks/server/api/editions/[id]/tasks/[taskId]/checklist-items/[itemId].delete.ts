import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canCommentTask } from '#server/utils/tasks-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * DELETE /api/editions/[id]/tasks/[taskId]/checklist-items/[itemId]
 *
 * Supprime un item de checklist. Accessible aux organisateurs avec
 * `canManageTasks` ou aux assignés de la tâche.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const taskId = Number(getRouterParam(event, 'taskId'))
    const itemId = Number(getRouterParam(event, 'itemId'))
    if (isNaN(taskId) || isNaN(itemId)) {
      throw createError({ status: 400, message: 'Identifiant invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, group: { editionId } },
      include: { assignments: { select: { userId: true } } },
    })
    if (!task) {
      throw createError({ status: 404, message: 'Tâche introuvable' })
    }

    const assigneeIds = task.assignments.map((a) => a.userId)
    if (!canCommentTask(edition, user, assigneeIds)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const existing = await prisma.taskChecklistItem.findFirst({
      where: { id: itemId, taskId },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Item introuvable' })
    }

    await prisma.taskChecklistItem.delete({ where: { id: itemId } })

    return createSuccessResponse({ success: true })
  },
  { operationName: 'DeleteTaskChecklistItem' }
)
