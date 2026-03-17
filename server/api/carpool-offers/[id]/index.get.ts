import { wrapApiHandler } from '#server/utils/api-helpers'
import { transformCarpoolOffer } from '#server/utils/carpool-transform'
import { carpoolOfferFullInclude } from '#server/utils/prisma-select-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const offerId = validateResourceId(event, 'id', 'offre')
    const viewerId = event.context.user?.id as number | undefined

    const offer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
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
    })

    if (!offer) {
      throw createError({
        status: 404,
        message: 'Offre de covoiturage introuvable',
      })
    }

    return transformCarpoolOffer(offer, viewerId)
  },
  { operationName: 'GetCarpoolOffer' }
)
