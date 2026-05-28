import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canCommentTask } from '#server/utils/tasks-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  done: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
})

/**
 * PUT /api/editions/[id]/tasks/[taskId]/checklist-items/[itemId]
 *
 * Met à jour un item de checklist (titre, état cochée, ordre).
 * Accessible aux organisateurs avec `canManageTasks` ou aux assignés.
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

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const item = await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.done !== undefined && { done: data.done }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
      },
    })

    return createSuccessResponse({ item })
  },
  { operationName: 'UpdateTaskChecklistItem' }
)
