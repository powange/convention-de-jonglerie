import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

import {
  editionPostCommentSchema,
  validateAndSanitize,
  handleValidationError,
} from '../../../../../../../server/utils/validation-schemas'
import { hasEditionEditPermission } from '../../../../../../utils/permissions'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    })
  }
  const user = event.context.user

  const editionId = parseInt(getRouterParam(event, 'id')!)
  const postId = parseInt(getRouterParam(event, 'postId')!)

  if (isNaN(editionId) || isNaN(postId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID invalide',
    })
  }

  try {
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
        statusMessage: 'Post non trouvé',
      })
    }

    // Vérifier les permissions pour commenter sur cette édition
    const hasPermission = await hasEditionEditPermission(user.id, editionId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Vous devez être collaborateur pour commenter sur cette édition',
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      handleValidationError(error)
    }

    if (error.statusCode) {
      throw error
    }

    console.error('Erreur lors de la création du commentaire:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur',
    })
  }
})
