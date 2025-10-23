import { getEmailHash } from '@@/server/utils/email-hash'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id')!)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  // Récupérer l'utilisateur connecté (optionnel)
  const session = await getUserSession(event)
  const userId = session?.user?.id

  try {
    // Vérifier que l'édition existe et que les workshops sont activés
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { workshopsEnabled: true },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!edition.workshopsEnabled) {
      throw createError({
        statusCode: 403,
        message: 'Les workshops ne sont pas activés pour cette édition',
      })
    }

    // Récupérer les workshops avec leurs créateurs, lieux et favoris
    const workshops = await prisma.workshop.findMany({
      where: { editionId },
      include: {
        creator: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        favorites: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : false,
      },
      orderBy: { startDateTime: 'asc' },
    })

    // Transformer les emails en emailHash et ajouter isFavorite
    const transformedWorkshops = workshops.map((workshop) => {
      const { email: creatorEmail, ...creatorWithoutEmail } = workshop.creator
      const { favorites, ...workshopWithoutFavorites } = workshop
      return {
        ...workshopWithoutFavorites,
        creator: {
          ...creatorWithoutEmail,
          emailHash: getEmailHash(creatorEmail),
        },
        isFavorite: userId ? favorites.length > 0 : false,
      }
    })

    return transformedWorkshops
  } catch (error: unknown) {
    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors de la récupération des workshops:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
