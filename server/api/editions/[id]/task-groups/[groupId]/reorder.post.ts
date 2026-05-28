import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  taskIds: z.array(z.number().int().positive()).min(1).max(500),
})

/**
 * POST /api/editions/[id]/task-groups/[groupId]/reorder
 *
 * Réordonne les tâches d'un groupe : pour chaque taskId du tableau, applique
 * un `displayOrder` correspondant à son index dans le tableau (0, 1, 2, …).
 * Le tableau peut contenir un sous-ensemble des tâches du groupe (ex: toutes
 * les tâches d'une colonne Kanban) — seules celles présentes sont mises à jour,
 * les autres conservent leur displayOrder existant.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const groupId = Number(getRouterParam(event, 'groupId'))
    if (isNaN(groupId)) {
      throw createError({ status: 400, message: 'Identifiant de groupe invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const group = await prisma.taskGroup.findFirst({
      where: { id: groupId, editionId },
    })
    if (!group) {
      throw createError({ status: 404, message: 'Groupe introuvable' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    // Vérifie que toutes les tâches appartiennent bien au groupe (sécurité +
    // protection contre les payloads forgés).
    const tasks = await prisma.task.findMany({
      where: { id: { in: data.taskIds }, taskGroupId: groupId },
      select: { id: true },
    })
    if (tasks.length !== data.taskIds.length) {
      throw createError({
        status: 400,
        message: "Certaines tâches n'appartiennent pas à ce groupe",
      })
    }

    // Update atomique des displayOrder selon l'index dans le tableau.
    await prisma.$transaction(
      data.taskIds.map((taskId, index) =>
        prisma.task.update({
          where: { id: taskId },
          data: { displayOrder: index },
        })
      )
    )

    return createSuccessResponse({ updated: data.taskIds.length })
  },
  { operationName: 'ReorderTasks' }
)
