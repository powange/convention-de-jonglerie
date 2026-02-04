import { wrapApiHandler } from '#server/utils/api-helpers'
import { carpoolOfferFullInclude } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const viewerId = event.context.user?.id as number | undefined
    const query = getQuery(event) || {}
    const includeArchived = query.includeArchived === 'true'

    const now = new Date()

    const carpoolOffers = await prisma.carpoolOffer.findMany({
      where: {
        editionId,
        // Filtrer les covoiturages passés si includeArchived est false
        ...(includeArchived ? {} : { tripDate: { gte: now } }),
      },
      include: {
        ...carpoolOfferFullInclude,
        passengers: {
          ...carpoolOfferFullInclude.passengers,
          orderBy: {
            addedAt: 'asc',
          },
        },
        comments: {
          ...carpoolOfferFullInclude.comments,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: { tripDate: 'asc' },
    })

    // Transformer les données pour masquer les emails et ajouter les hash
    const transformedOffers = carpoolOffers.map((offer) => {
      const bookings = offer.bookings ?? []
      const passengers = offer.passengers ?? []
      const comments = offer.comments ?? []
      const availableSeats = typeof offer.availableSeats === 'number' ? offer.availableSeats : 0

      const viewerIsOwner = !!viewerId && viewerId === offer.userId
      const viewerHasAccepted =
        !!viewerId && bookings.some((b) => b.status === 'ACCEPTED' && b.requesterId === viewerId)

      return {
        id: offer.id,
        editionId: offer.editionId,
        userId: offer.userId,
        tripDate: offer.tripDate,
        locationCity: offer.locationCity,
        locationAddress: offer.locationAddress,
        availableSeats,
        description: offer.description,
        // n'exposer le contact que pour le propriétaire ou un réservant ACCEPTED
        phoneNumber: viewerIsOwner || viewerHasAccepted ? offer.phoneNumber : null,
        smokingAllowed: offer.smokingAllowed,
        petsAllowed: offer.petsAllowed,
        musicAllowed: offer.musicAllowed,
        direction: offer.direction,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
        remainingSeats: Math.max(
          0,
          availableSeats -
            bookings
              .filter((b) => b.status === 'ACCEPTED')
              .reduce((s: number, b) => s + (b.seats || 0), 0)
        ),
        user: offer.user
          ? {
              id: offer.user.id,
              pseudo: offer.user.pseudo,
              emailHash: offer.user.emailHash,
              profilePicture: offer.user.profilePicture ?? null,
              updatedAt: offer.user.updatedAt,
            }
          : undefined,
        // Maintenu temporairement pour compatibilité, mais l'UI ne l'utilisera plus
        passengers: passengers.map((passenger) => ({
          id: passenger.id,
          addedAt: passenger.addedAt,
          user: passenger.user
            ? {
                id: passenger.user.id,
                pseudo: passenger.user.pseudo,
                emailHash: passenger.user.emailHash,
                profilePicture: passenger.user.profilePicture ?? null,
                updatedAt: passenger.user.updatedAt,
              }
            : undefined,
        })),
        // Exposer les réservations avec requester anonymisé
        bookings: bookings.map((b) => ({
          id: b.id,
          carpoolOfferId: b.carpoolOfferId,
          requestId: b.requestId,
          seats: b.seats,
          message: b.message,
          status: b.status,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
          requester: b.requester
            ? {
                id: b.requester.id,
                pseudo: b.requester.pseudo,
                emailHash: b.requester.emailHash,
                profilePicture: b.requester.profilePicture ?? null,
                updatedAt: b.requester.updatedAt,
              }
            : undefined,
        })),
        comments: comments.map((comment) => ({
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          user: comment.user
            ? {
                id: comment.user.id,
                pseudo: comment.user.pseudo,
                emailHash: comment.user.emailHash,
                profilePicture: comment.user.profilePicture ?? null,
                updatedAt: comment.user.updatedAt,
              }
            : undefined,
        })),
      }
    })

    return transformedOffers
  },
  { operationName: 'GetCarpoolOffers' }
)
