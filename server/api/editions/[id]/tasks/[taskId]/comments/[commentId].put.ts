import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Le contenu est requis')
    .max(5000, 'Le contenu ne peut pas dépasser 5000 caractères'),
})

/**
 * PUT /api/editions/[id]/tasks/[taskId]/comments/[commentId]
 *
 * Édite un commentaire. Seul l'auteur peut éditer son propre commentaire.
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

    if (comment.userId !== user.id) {
      throw createError({
        status: 403,
        message: 'Vous ne pouvez éditer que vos propres commentaires',
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

    const updated = await prisma.taskComment.update({
      where: { id: commentId },
      data: { content: data.content, editedAt: new Date() },
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

    return createSuccessResponse({ comment: updated })
  },
  { operationName: 'UpdateTaskComment' }
)
