import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification
    const user = requireAuth(event)

    // Récupérer les IDs des éditions favorites de l'utilisateur
    const favoriteEditions = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        favoriteEditions: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!favoriteEditions) {
      throw createError({
        status: 404,
        message: 'Utilisateur introuvable',
      })
    }

    // Retourner uniquement les IDs des éditions favorites
    return favoriteEditions.favoriteEditions.map((edition) => edition.id)
  },
  { operationName: 'GetFavoriteEditions' }
)
