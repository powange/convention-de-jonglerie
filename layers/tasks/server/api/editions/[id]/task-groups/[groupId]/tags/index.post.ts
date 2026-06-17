import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { TASK_TAG_COLOR_PATTERN } from '#server/utils/task-tags-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est requis')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères'),
  color: z
    .string()
    .regex(TASK_TAG_COLOR_PATTERN, 'La couleur doit être au format hexadécimal #RRGGBB'),
  displayOrder: z.number().int().optional(),
})

/**
 * POST /api/editions/[id]/task-groups/[groupId]/tags
 *
 * Crée un nouveau tag sur un groupe de tâches. Permission `canManageTasks`
 * requise. Le `displayOrder` est calculé automatiquement (max + 1 parmi les
 * tags existants du groupe). Le couple (taskGroupId, name) est unique :
 * tentative de création d'un tag de même nom sur le même groupe retourne 409.
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
      select: { id: true },
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

    let displayOrder = data.displayOrder
    if (displayOrder === undefined) {
      const max = await prisma.taskTag.aggregate({
        where: { taskGroupId: groupId },
        _max: { displayOrder: true },
      })
      displayOrder = (max._max.displayOrder ?? -1) + 1
    }

    try {
      const tag = await prisma.taskTag.create({
        data: { taskGroupId: groupId, name: data.name, color: data.color, displayOrder },
        select: { id: true, name: true, color: true, displayOrder: true },
      })
      return createSuccessResponse({ tag })
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code
      if (code === 'P2002') {
        throw createError({ status: 409, message: 'Un tag avec ce nom existe déjà' })
      }
      throw e
    }
  },
  { operationName: 'CreateTaskTag' }
)
