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
  name: z
    .string()
    .trim()
    .min(1, 'Le nom du groupe est requis')
    .max(120, 'Le nom du groupe ne peut pas dépasser 120 caractères'),
  description: z
    .string()
    .trim()
    .max(2000, 'La description ne peut pas dépasser 2000 caractères')
    .nullable()
    .optional(),
  displayOrder: z.number().int().optional(),
})

/**
 * POST /api/editions/[id]/task-groups
 *
 * Crée un nouveau groupe de tâches. displayOrder est par défaut placé
 * à la fin de la liste existante.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les tâches de cette édition",
      })
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
      const last = await prisma.taskGroup.findFirst({
        where: { editionId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      })
      displayOrder = (last?.displayOrder ?? -1) + 1
    }

    const group = await prisma.taskGroup.create({
      data: {
        editionId,
        name: data.name,
        description: data.description?.trim() || null,
        displayOrder,
      },
      include: { tasks: true },
    })

    return createSuccessResponse({ group })
  },
  { operationName: 'CreateTaskGroup' }
)
