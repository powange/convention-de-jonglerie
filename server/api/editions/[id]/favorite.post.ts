import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(event.context.params?.id as string)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid Edition ID',
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
        message: 'Edition introuvable',
      })
    }

    const userWithFavorites = await prisma.user.findUnique({
      where: { id: user.id },
      include: { favoriteEditions: true },
    })

    if (!userWithFavorites) {
      throw createError({
        statusCode: 404,
        message: 'User not found',
      })
    }

    const isFavorited = userWithFavorites.favoriteEditions.some(
      (edition) => edition.id === editionId
    )

    if (isFavorited) {
      // Remove from favorites
      await prisma.user.update({
        where: { id: user.id },
        data: {
          favoriteEditions: {
            disconnect: { id: editionId },
          },
        },
      })
      return { message: 'Edition removed from favorites', isFavorited: false }
    } else {
      // Add to favorites
      await prisma.user.update({
        where: { id: user.id },
        data: {
          favoriteEditions: {
            connect: { id: editionId },
          },
        },
      })
      return { message: 'Edition added to favorites', isFavorited: true }
    }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Internal Server Error',
    })
  }
})
