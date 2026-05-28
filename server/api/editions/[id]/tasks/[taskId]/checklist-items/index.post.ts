import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canCommentTask } from '#server/utils/tasks-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Le titre est requis')
    .max(200, 'Le titre ne peut pas dépasser 200 caractères'),
})

/**
 * POST /api/editions/[id]/tasks/[taskId]/checklist-items
 *
 * Crée un item de checklist sur une tâche. Accessible aux organisateurs avec
 * `canManageTasks` ou aux assignés de la tâche. Le `displayOrder` est calculé
 * automatiquement (max + 1 parmi les items existants de la tâche).
 */
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

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const maxOrder = await prisma.taskChecklistItem.aggregate({
      where: { taskId },
      _max: { displayOrder: true },
    })
    const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1

    const item = await prisma.taskChecklistItem.create({
      data: {
        taskId,
        title: data.title,
        displayOrder,
      },
    })

    return createSuccessResponse({ item })
  },
  { operationName: 'CreateTaskChecklistItem' }
)
