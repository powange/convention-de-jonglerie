import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { carpoolBookingInclude } from '@@/server/utils/prisma-select-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const offerId = validateResourceId(event, 'id', 'offre')

    const offer = await fetchResourceOrFail(prisma.carpoolOffer, offerId, {
      errorMessage: 'Offre de covoiturage introuvable',
    })

    const userId = event.context.user?.id as number | undefined
    const isOwner = !!userId && userId === offer.userId

    const bookings = await prisma.carpoolBooking.findMany({
      where: isOwner
        ? { carpoolOfferId: offerId }
        : userId
          ? { carpoolOfferId: offerId, requesterId: userId }
          : { carpoolOfferId: -1 },
      orderBy: { createdAt: 'desc' },
      include: carpoolBookingInclude,
    })

    return bookings.map((b) => ({
      id: b.id,
      carpoolOfferId: b.carpoolOfferId,
      requestId: b.requestId,
      seats: b.seats,
      message: b.message,
      status: b.status,
      createdAt: b.createdAt,
      requester: {
        id: b.requester.id,
        pseudo: b.requester.pseudo,
        emailHash: b.requester.emailHash,
        profilePicture: b.requester.profilePicture,
        updatedAt: b.requester.updatedAt,
      },
    }))
  },
  { operationName: 'GetCarpoolOfferBookings' }
)
