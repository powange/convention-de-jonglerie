import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = await requireUserSession(event)

  const editionId = parseInt(getRouterParam(event, 'id')!)
  const workshopId = parseInt(getRouterParam(event, 'workshopId')!)

  if (isNaN(editionId) || isNaN(workshopId)) {
    throw createError({
      statusCode: 400,
      message: 'ID invalide',
    })
  }

  try {
    // Vérifier que le workshop existe et appartient à l'édition
    const workshop = await prisma.workshop.findFirst({
      where: {
        id: workshopId,
        editionId,
      },
    })

    if (!workshop) {
      throw createError({
        statusCode: 404,
        message: 'Workshop non trouvé',
      })
    }

    // Supprimer le favori
    await prisma.workshopFavorite.deleteMany({
      where: {
        workshopId,
        userId: user.user.id,
      },
    })

    return {
      success: true,
    }
  } catch (error: unknown) {
    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors de la suppression du favori:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
