import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const editionId = parseInt(event.context.params?.id as string)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Edition ID',
    })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: event.context.user.id },
      include: { favoriteEditions: true },
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found',
      })
    }

    const isFavorited = user.favoriteEditions.some((edition) => edition.id === editionId)

    if (isFavorited) {
      // Remove from favorites
      await prisma.user.update({
        where: { id: event.context.user.id },
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
        where: { id: event.context.user.id },
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
      statusMessage: 'Internal Server Error',
    })
  }
})
