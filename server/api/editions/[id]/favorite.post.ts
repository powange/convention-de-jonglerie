import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier que l'édition existe
    await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition introuvable',
    })

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
  },
  { operationName: 'ToggleEditionFavorite' }
)
