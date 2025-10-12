import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  try {
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
        statusCode: 404,
        message: 'Utilisateur introuvable',
      })
    }

    // Retourner uniquement les IDs des éditions favorites
    return favoriteEditions.favoriteEditions.map((edition) => edition.id)
  } catch (error) {
    console.error('Erreur lors de la récupération des éditions favorites:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    })
  }
})
