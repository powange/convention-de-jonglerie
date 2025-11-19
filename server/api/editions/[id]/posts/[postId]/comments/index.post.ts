import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { hasEditionEditPermission } from '@@/server/utils/permissions/permissions'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

import {
  editionPostCommentSchema,
  validateAndSanitize,
} from '../../../../../../../server/utils/validation-schemas'

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
        statusCode: 404,
        message: 'Post non trouvé',
      })
    }

    // Vérifier les permissions pour commenter sur cette édition
    const hasPermission = await hasEditionEditPermission(user.id, editionId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message: 'Vous devez être organisateur pour commenter sur cette édition',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(editionPostCommentSchema, body)

    // Créer le commentaire
    const newComment = await prisma.editionPostComment.create({
      data: {
        content: validatedData.content,
        editionPostId: postId,
        userId: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
          },
        },
      },
    })

    return newComment
  },
  { operationName: 'CreatePostComment' }
)
