import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string)

    if (!editionId || isNaN(editionId)) {
      throw createError({
        statusCode: 400,
        statusMessage: "ID d'édition invalide",
      })
    }

    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, endDate: true },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Édition non trouvée',
      })
    }

    // Récupérer tous les objets trouvés de l'édition
    const lostFoundItems = await prisma.lostFoundItem.findMany({
      where: { editionId },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return lostFoundItems
  } catch (error) {
    console.error('Erreur lors de la récupération des objets trouvés:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur',
    })
  }
})
