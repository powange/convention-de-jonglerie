import { getEmailHash } from '../../../utils/email-hash'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const offerId = parseInt(event.context.params?.id as string)
  if (!offerId) {
    throw createError({ statusCode: 400, statusMessage: "ID de l'offre invalide" })
  }

  const offer = await prisma.carpoolOffer.findUnique({ where: { id: offerId } })
  if (!offer) {
    throw createError({ statusCode: 404, statusMessage: 'Offre de covoiturage introuvable' })
  }

  const userId = event.context.user?.id as number | undefined
  const isOwner = !!userId && userId === offer.userId

  const bookings = await prisma.carpoolBooking.findMany({
    where: isOwner
      ? { carpoolOfferId: offerId }
      : userId
        ? { carpoolOfferId: offerId, requesterId: userId }
        : { carpoolOfferId: -1 },
    orderBy: { createdAt: 'desc' },
    include: { requester: true },
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
      emailHash: getEmailHash(b.requester.email),
      profilePicture: b.requester.profilePicture,
      updatedAt: b.requester.updatedAt,
    },
  }))
})
