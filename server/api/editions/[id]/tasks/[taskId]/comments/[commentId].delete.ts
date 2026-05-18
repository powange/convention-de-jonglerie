import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * DELETE /api/editions/[id]/tasks/[taskId]/comments/[commentId]
 *
 * Supprime un commentaire. Autorisé pour :
 * - l'auteur du commentaire
 * - les organisateurs avec `canManageTasks` (modération)
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const taskId = Number(getRouterParam(event, 'taskId'))
    const commentId = Number(getRouterParam(event, 'commentId'))
    if (isNaN(taskId) || isNaN(commentId)) {
      throw createError({ status: 400, message: 'Identifiant invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    const comment = await prisma.taskComment.findFirst({
      where: { id: commentId, taskId, task: { group: { editionId } } },
      select: { userId: true },
    })
    if (!comment) {
      throw createError({ status: 404, message: 'Commentaire introuvable' })
    }

    const isAuthor = comment.userId === user.id
    const isModerator = canManageTasks(edition, user)
    if (!isAuthor && !isModerator) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    await prisma.taskComment.delete({ where: { id: commentId } })

    return createSuccessResponse({ success: true })
  },
  { operationName: 'DeleteTaskComment' }
)
