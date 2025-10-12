import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  try {
    // Récupérer toutes les statistiques en parallèle pour optimiser les performances
    const [conventionsCreated, editionsFavorited, favoritesReceived] = await Promise.all([
      // Nombre de conventions créées par l'utilisateur
      prisma.convention.count({
        where: { authorId: user.id },
      }),

      // Nombre d'éditions mises en favoris par l'utilisateur
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          _count: {
            select: {
              favoriteEditions: true,
            },
          },
        },
      }),

      // Nombre total de favoris reçus sur toutes les éditions créées par l'utilisateur
      prisma.edition.findMany({
        where: { creatorId: user.id },
        select: {
          _count: {
            select: {
              favoritedBy: true,
            },
          },
        },
      }),
    ])

    // Calculer le total des favoris reçus
    const totalFavoritesReceived = favoritesReceived.reduce(
      (total, edition) => total + edition._count.favoritedBy,
      0
    )

    return {
      conventionsCreated,
      editionsFavorited: editionsFavorited?._count.favoriteEditions || 0,
      favoritesReceived: totalFavoritesReceived,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques du profil:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur lors de la récupération des statistiques',
    })
  }
})
