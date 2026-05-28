import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * DELETE /api/editions/[id]/task-groups/[groupId]/tags/[tagId]
 *
 * Supprime un tag. Les assignations (TaskTagAssignment) sont supprimées en
 * cascade automatiquement par Prisma. Permission `canManageTasks` requise.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const groupId = Number(getRouterParam(event, 'groupId'))
    const tagId = Number(getRouterParam(event, 'tagId'))
    if (isNaN(groupId) || isNaN(tagId)) {
      throw createError({ status: 400, message: 'Identifiant invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const existing = await prisma.taskTag.findFirst({
      where: { id: tagId, taskGroupId: groupId, group: { editionId } },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Tag introuvable' })
    }

    await prisma.taskTag.delete({ where: { id: tagId } })

    return createSuccessResponse({ success: true })
  },
  { operationName: 'DeleteTaskTag' }
)
