import { wrapApiHandler } from '#server/utils/api-helpers'
import { transformCarpoolOffer } from '#server/utils/carpool-transform'
import { carpoolOfferListInclude } from '#server/utils/prisma-select-helpers'
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
        ...(includeArchived ? {} : { tripDate: { gte: now } }),
      },
      // Le compte des commentaires et les seules réservations acceptées : voir
      // `carpoolOfferListInclude` pour ce que la carte lit réellement.
      include: {
        ...carpoolOfferListInclude,
        passengers: {
          ...carpoolOfferListInclude.passengers,
          orderBy: { addedAt: 'asc' },
        },
      },
      orderBy: { tripDate: 'asc' },
    })

    return carpoolOffers.map((offer) => transformCarpoolOffer(offer, viewerId))
  },
  { operationName: 'GetCarpoolOffers' }
)
