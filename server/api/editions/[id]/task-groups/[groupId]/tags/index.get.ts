import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/task-groups/[groupId]/tags
 *
 * Liste les tags définis sur un groupe de tâches (ordonnés par displayOrder).
 * Accessible à tout utilisateur authentifié (utile pour le filtre dans
 * « Mes tâches » côté bénévoles).
 */
export default wrapApiHandler(
  async (event) => {
    requireAuth(event)
    const editionId = validateEditionId(event)
    const groupId = Number(getRouterParam(event, 'groupId'))
    if (isNaN(groupId)) {
      throw createError({ status: 400, message: 'Identifiant de groupe invalide' })
    }

    const group = await prisma.taskGroup.findFirst({
      where: { id: groupId, editionId },
      select: { id: true },
    })
    if (!group) {
      throw createError({ status: 404, message: 'Groupe introuvable' })
    }

    const tags = await prisma.taskTag.findMany({
      where: { taskGroupId: groupId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, color: true, displayOrder: true },
    })

    return createSuccessResponse({ tags })
  },
  { operationName: 'GetTaskGroupTags' }
)
