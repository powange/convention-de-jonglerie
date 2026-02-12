import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const postId = validateResourceId(event, 'postId', 'post')
    const commentId = validateResourceId(event, 'commentId', 'commentaire')

    // Vérifier que le commentaire existe
    const comment = await prisma.editionPostComment.findFirst({
      where: {
        id: commentId,
        editionPostId: postId,
      },
      include: {
        editionPost: {
          select: { editionId: true },
        },
      },
    })

    if (!comment || comment.editionPost.editionId !== editionId) {
      throw createError({
        status: 404,
        message: 'Commentaire non trouvé',
      })
    }

    // L'auteur peut supprimer son propre commentaire
    // Les organisateurs peuvent modérer (supprimer n'importe quel commentaire)
    if (comment.userId !== user.id) {
      const isOrganizer = await canAccessEditionData(editionId, user.id, event)
      if (!isOrganizer) {
        throw createError({
          status: 403,
          message: "Vous n'êtes pas autorisé à supprimer ce commentaire",
        })
      }
    }

    // Supprimer le commentaire
    await prisma.editionPostComment.delete({
      where: { id: commentId },
    })

    return createSuccessResponse(null, 'Commentaire supprimé avec succès')
  },
  { operationName: 'DeletePostComment' }
)
