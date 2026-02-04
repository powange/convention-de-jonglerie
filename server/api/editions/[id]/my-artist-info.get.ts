import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Récupérer l'artiste de l'utilisateur pour cette édition
    const artist = await prisma.editionArtist.findUnique({
      where: {
        editionId_userId: {
          editionId,
          userId: user.id,
        },
      },
      select: {
        id: true,
        arrivalDateTime: true,
        departureDateTime: true,
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
        user: {
          select: {
            prenom: true,
            nom: true,
            email: true,
          },
        },
        shows: {
          select: {
            show: {
              select: {
                id: true,
                title: true,
                startDateTime: true,
                location: true,
                returnableItems: {
                  select: {
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
    })

    if (!artist) {
      return {
        artist: null,
      }
    }

    // Récupérer et dédupliquer les articles à restituer depuis tous les spectacles
    const uniqueItems = new Map()
    artist.shows.forEach((showArtist) => {
      showArtist.show.returnableItems.forEach((item) => {
        if (!uniqueItems.has(item.returnableItem.id)) {
          uniqueItems.set(item.returnableItem.id, item.returnableItem)
        }
      })
    })
    const deduplicatedItems = Array.from(uniqueItems.values())

    return {
      artist: {
        id: artist.id,
        firstName: artist.user.prenom,
        lastName: artist.user.nom,
        email: artist.user.email,
        qrCode: `artist-${artist.id}`, // Format compatible avec le contrôle d'accès
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
        returnableItems: deduplicatedItems.map((item) => ({
          id: item.id,
          name: item.name,
        })),
      },
    }
  },
  { operationName: 'GetMyArtistInfo' }
)
