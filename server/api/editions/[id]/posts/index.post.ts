import { requireAuth } from '@@/server/utils/auth-utils'
import { hasEditionEditPermission } from '@@/server/utils/permissions/permissions'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

import {
  editionPostSchema,
  validateAndSanitize,
  handleValidationError,
} from '@@/server/utils/validation-schemas'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id')!)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
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
        message: 'Édition non trouvée',
      })
    }

    // Vérifier les permissions pour poster sur cette édition
    const hasPermission = await hasEditionEditPermission(user.id, editionId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message: 'Vous devez être collaborateur pour poster sur cette édition',
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
      message: 'Erreur interne du serveur',
    })
  }
})
