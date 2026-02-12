import {
  editionPostCommentSchema,
  validateAndSanitize,
} from '../../../../../../../server/utils/validation-schemas'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
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

    // Vérifier que le dernier commentaire n'est pas du même utilisateur (anti-spam)
    const lastComment = await prisma.editionPostComment.findFirst({
      where: { editionPostId: postId },
      orderBy: { createdAt: 'desc' },
      select: { userId: true },
    })

    if (lastComment?.userId === user.id) {
      throw createError({
        status: 429,
        message: 'Vous ne pouvez pas poster deux commentaires consécutifs',
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
