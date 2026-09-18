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

    // Vérifie que toutes les tâches appartiennent bien au groupe (sécurité + protection contre les
    // payloads forgés). La comparaison des longueurs rejette aussi les doublons, que `findMany`
    // dédoublonne. `displayOrder` est lu au passage : voir juste en dessous.
    const tasks = await prisma.task.findMany({
      where: { id: { in: data.taskIds }, taskGroupId: groupId },
      select: { id: true, displayOrder: true },
    })
    if (tasks.length !== data.taskIds.length) {
      throw createError({
        status: 400,
        message: "Certaines tâches n'appartiennent pas à ce groupe",
      })
    }

    /**
     * On n'écrit que ce qui CHANGE.
     *
     * Déplacer une carte d'un rang ne dérange que deux positions : réécrire toute la colonne
     * envoyait autant de requêtes qu'elle comptait de tâches, pour rien. La position actuelle est
     * déjà sous la main — la vérification d'appartenance ci-dessus lit les mêmes lignes —, donc
     * la comparaison ne coûte aucune requête supplémentaire.
     *
     * Un réordonnancement qui ne change rien n'écrit plus rien du tout, et ne prend plus de
     * verrou : c'est le cas d'un glissement relâché à sa place de départ.
     */
    const positionActuelle = new Map(tasks.map((t) => [t.id, t.displayOrder]))
    const aEcrire = data.taskIds
      .map((taskId, index) => ({ taskId, index }))
      .filter(({ taskId, index }) => positionActuelle.get(taskId) !== index)

    if (aEcrire.length > 0) {
      // `updateMany` redit `taskGroupId` : une tâche déplacée entre la vérification et l'écriture
      // ne serait pas touchée.
      await prisma.$transaction(
        aEcrire.map(({ taskId, index }) =>
          prisma.task.updateMany({
            where: { id: taskId, taskGroupId: groupId },
            data: { displayOrder: index },
          })
        )
      )
    }

    return createSuccessResponse({ updated: aEcrire.length })
  },
  { operationName: 'ReorderTasks' }
)
