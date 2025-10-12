import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  try {
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    // Récupérer les équipes de bénévoles pour cette édition
    // Accès public en lecture pour permettre l'affichage dans le formulaire de candidature
    const teams = await prisma.volunteerTeam.findMany({
      where: {
        editionId,
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            timeSlots: true,
          },
        },
      },
    })

    return teams
  } catch (error) {
    // Si c'est déjà une erreur HTTP, la relancer
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des équipes de bénévoles',
    })
  }
})
