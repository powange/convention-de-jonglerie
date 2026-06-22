import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const postId = validateResourceId(event, 'postId', 'post')

    // Vérifier que le post existe
    const post = await prisma.editionPost.findFirst({
      where: {
        id: postId,
        editionId,
      },
    })

    if (!post) {
      throw createError({
        status: 404,
        message: 'Post non trouvé',
      })
    }

    // L'auteur peut supprimer son propre post
    // Les organisateurs peuvent modérer (supprimer n'importe quel post)
    if (post.userId !== user.id) {
      const isOrganizer = await canAccessEditionData(editionId, user.id, event)
      if (!isOrganizer) {
        throw createError({
          status: 403,
          message: "Vous n'êtes pas autorisé à supprimer ce post",
        })
      }
    }

    // Supprimer le post (les commentaires seront supprimés automatiquement grâce à onDelete: Cascade)
    await prisma.editionPost.delete({
      where: { id: postId },
    })

    return createSuccessResponse(null, 'Post supprimé avec succès')
  },
  { operationName: 'DeleteEditionPost' }
)
