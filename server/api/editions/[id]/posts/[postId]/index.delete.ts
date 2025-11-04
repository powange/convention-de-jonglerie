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

    // Vérifier que le post existe et appartient à l'utilisateur
    const post = await prisma.editionPost.findFirst({
      where: {
        id: postId,
        editionId,
        userId: user.id,
      },
    })

    if (!post) {
      throw createError({
        statusCode: 404,
        message: "Post non trouvé ou vous n'êtes pas autorisé à le supprimer",
      })
    }

    // Supprimer le post (les commentaires seront supprimés automatiquement grâce à onDelete: Cascade)
    await prisma.editionPost.delete({
      where: { id: postId },
    })

    return createSuccessResponse(null, 'Post supprimé avec succès')
  },
  { operationName: 'DeleteEditionPost' }
)
