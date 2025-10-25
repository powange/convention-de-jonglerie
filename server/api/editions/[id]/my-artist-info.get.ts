import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')

  if (!editionId) {
    throw createError({ statusCode: 400, message: 'Edition invalide' })
  }

  try {
    // Récupérer l'artiste de l'utilisateur pour cette édition
    const artist = await prisma.editionArtist.findUnique({
      where: {
        editionId_userId: {
          editionId,
          userId: user.id,
        },
      },
      include: {
        user: {
          select: {
            prenom: true,
            nom: true,
            email: true,
          },
        },
        shows: {
          include: {
            show: {
              select: {
                id: true,
                title: true,
                startDateTime: true,
                location: true,
              },
            },
          },
        },
      },
    })

    if (!artist) {
      return {
        artist: null,
      }
    }

    return {
      artist: {
        id: artist.id,
        firstName: artist.user.prenom,
        lastName: artist.user.nom,
        email: artist.user.email,
        qrCode: `volunteer-${artist.id}`, // Format compatible avec le contrôle d'accès
        arrivalDateTime: artist.arrivalDateTime,
        departureDateTime: artist.departureDateTime,
        dietaryPreference: artist.dietaryPreference,
        allergies: artist.allergies,
        allergySeverity: artist.allergySeverity,
        shows: artist.shows.map((sa) => ({
          id: sa.show.id,
          title: sa.show.title,
          startDateTime: sa.show.startDateTime,
          location: sa.show.location,
        })),
      },
    }
  } catch (error: unknown) {
    console.error("Erreur lors de la récupération des informations de l'artiste:", error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la récupération des informations de l'artiste",
    })
  }
})
