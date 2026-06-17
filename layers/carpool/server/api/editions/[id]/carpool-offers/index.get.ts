import { wrapApiHandler } from '#server/utils/api-helpers'
import { transformCarpoolOffer } from '#server/utils/carpool-transform'
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
        ...(includeArchived ? {} : { tripDate: { gte: now } }),
      },
      include: {
        ...carpoolOfferFullInclude,
        passengers: {
          ...carpoolOfferFullInclude.passengers,
          orderBy: { addedAt: 'asc' },
        },
        comments: {
          ...carpoolOfferFullInclude.comments,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { tripDate: 'asc' },
    })

    return carpoolOffers.map((offer) => transformCarpoolOffer(offer, viewerId))
  },
  { operationName: 'GetCarpoolOffers' }
)
