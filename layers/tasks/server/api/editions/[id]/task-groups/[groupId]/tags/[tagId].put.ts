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
  name: z.string().trim().min(1).max(50).optional(),
  color: z
    .string()
    .regex(TASK_TAG_COLOR_PATTERN, 'La couleur doit être au format hexadécimal #RRGGBB')
    .optional(),
  displayOrder: z.number().int().optional(),
})

/**
 * PUT /api/editions/[id]/task-groups/[groupId]/tags/[tagId]
 *
 * Met à jour un tag (nom, couleur, ordre). Permission `canManageTasks` requise.
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

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    try {
      const tag = await prisma.taskTag.update({
        where: { id: tagId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        },
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
  { operationName: 'UpdateTaskTag' }
)
