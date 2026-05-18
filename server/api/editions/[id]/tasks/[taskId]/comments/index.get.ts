import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canCommentTask } from '#server/utils/tasks-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/tasks/[taskId]/comments
 *
 * Liste les commentaires d'une tâche, du plus ancien au plus récent.
 * Accessible aux organisateurs avec `canManageTasks` ou aux assignés de la
 * tâche.
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

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            email: true,
            emailHash: true,
            profilePicture: true,
          },
        },
      },
    })

    return createSuccessResponse({ comments })
  },
  { operationName: 'GetTaskComments' }
)
