import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  try {
    const artistProfiles = await prisma.editionArtist.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        arrivalDateTime: true,
        departureDateTime: true,
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
        createdAt: true,
        updatedAt: true,
        edition: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            city: true,
            country: true,
            imageUrl: true,
            convention: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
        },
        shows: {
          select: {
            show: {
              select: {
                id: true,
                title: true,
                description: true,
                startDateTime: true,
                duration: true,
                location: true,
                returnableItems: {
                  include: {
                    returnableItem: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return artistProfiles
  } catch (error) {
    console.error("Erreur lors de la récupération des profils d'artiste:", error)

    throw createError({
      statusCode: 500,
      message: "Erreur serveur lors de la récupération des profils d'artiste",
    })
  }
})
