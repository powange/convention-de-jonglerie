import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { userWithProfileSelect } from '#server/utils/prisma-select-helpers'
import { sanitizeUserContent, validateResourceId } from '#server/utils/validation-helpers'

const bookingSchema = z.object({
  seats: z.number().int().min(1).max(8),
  message: z.string().max(500).optional(),
  requestId: z.number().int().positive().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const offerId = validateResourceId(event, 'id', 'offre')

    const body = await readBody(event)
    const { seats, message: rawMessage, requestId } = bookingSchema.parse(body)
    const message = rawMessage ? sanitizeUserContent(rawMessage) : undefined

    // Récupérer l'offre et vérifier droits/capacité
    const offer = await fetchResourceOrFail(prisma.carpoolOffer, offerId, {
      include: {
        user: true,
        bookings: true,
      },
      errorMessage: 'Offre de covoiturage introuvable',
    })

    // Le créateur ne peut pas réserver sur sa propre offre
    if (offer.userId === user.id) {
      throw createError({
        status: 400,
        message: 'Impossible de réserver votre propre offre',
      })
    }

    // Si requestId fourni, vérifier l'existence et l'appartenance à l'utilisateur courant
    if (requestId) {
      const req = await fetchResourceOrFail(prisma.carpoolRequest, requestId, {
        errorMessage: 'Demande invalide',
      })
      if (req.userId !== user.id || req.editionId !== offer.editionId) {
        throw createError({ status: 400, message: 'Demande invalide' })
      }
    }

    // Calculer les places déjà acceptées
    const acceptedSeats = offer.bookings
      .filter((b) => b.status === 'ACCEPTED')
      .reduce((sum, b) => sum + (b.seats || 0), 0)

    if (acceptedSeats + seats > offer.availableSeats) {
      throw createError({ status: 400, message: 'Plus assez de places disponibles' })
    }

    // Option: éviter multi-PENDING du même utilisateur sur la même offre
    const existingPending = await prisma.carpoolBooking.findFirst({
      where: { carpoolOfferId: offerId, requesterId: user.id, status: 'PENDING' },
    })
    if (existingPending) {
      throw createError({ status: 400, message: 'Une réservation en attente existe déjà' })
    }

    const booking = await prisma.carpoolBooking.create({
      data: {
        carpoolOfferId: offerId,
        requesterId: user.id,
        seats,
        message,
        requestId,
        status: 'PENDING',
      },
      include: {
        requester: { select: userWithProfileSelect },
      },
    })

    // Envoyer une notification au propriétaire de l'offre
    const requesterName = booking.requester.pseudo || `Utilisateur ${booking.requester.id}`
    await safeNotify(
      () =>
        NotificationHelpers.carpoolBookingReceived(
          offer.userId,
          requesterName,
          offerId,
          seats,
          message
        ),
      'covoiturage réservation reçue'
    )

    return createSuccessResponse(booking)
  },
  { operationName: 'CreateCarpoolOfferBooking' }
)
