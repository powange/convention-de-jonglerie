import { wrapApiHandler, createSuccessResponse } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const postId = validateResourceId(event, 'postId', 'post')
    const commentId = validateResourceId(event, 'commentId', 'commentaire')

    // Vérifier que le commentaire existe et appartient à l'utilisateur
    const comment = await prisma.editionPostComment.findFirst({
      where: {
        id: commentId,
        editionPostId: postId,
        userId: user.id,
      },
      include: {
        editionPost: {
          select: { editionId: true },
        },
      },
    })

    if (!comment || comment.editionPost.editionId !== editionId) {
      throw createError({
        statusCode: 404,
        message: "Commentaire non trouvé ou vous n'êtes pas autorisé à le supprimer",
      })
    }

    // Supprimer le commentaire
    await prisma.editionPostComment.delete({
      where: { id: commentId },
    })

    return createSuccessResponse(null, 'Commentaire supprimé avec succès')
  },
  { operationName: 'DeletePostComment' }
)
