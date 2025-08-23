import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

import {
  editionPostSchema,
  validateAndSanitize,
  handleValidationError,
} from '../../../../../server/utils/validation-schemas'

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

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'édition invalide",
    })
  }

  try {
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Édition non trouvée',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(editionPostSchema, body)

    // Créer le post
    const newPost = await prisma.editionPost.create({
      data: {
        content: validatedData.content,
        editionId,
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
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return newPost
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      handleValidationError(error)
    }

    if (error.statusCode) {
      throw error
    }

    console.error('Erreur lors de la création du post:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur',
    })
  }
})
