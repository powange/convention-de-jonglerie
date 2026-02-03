import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '@@/server/utils/notification-service'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { userWithProfileSelect } from '@@/server/utils/prisma-select-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const offerId = validateResourceId(event, 'id', 'offre')
    const bookingId = validateResourceId(event, 'bookingId', 'demande')

    const body = await readBody(event)
    const action = body?.action as 'ACCEPT' | 'REJECT' | 'CANCEL'
    if (!action) {
      throw createError({ statusCode: 400, message: 'Action manquante' })
    }

    // Récupérer l'offre et la réservation
    const offer = await fetchResourceOrFail(prisma.carpoolOffer, offerId, {
      include: { user: true, bookings: true },
      errorMessage: 'Offre introuvable',
    })

    const booking = await fetchResourceOrFail(prisma.carpoolBooking, bookingId, {
      errorMessage: 'Réservation introuvable',
    })
    if (booking.carpoolOfferId !== offerId) {
      throw createError({ statusCode: 404, message: 'Réservation introuvable' })
    }

    // Droits:
    // - ACCEPT/REJECT: uniquement le créateur de l'offre
    // - CANCEL: le demandeur de la réservation
    const userId = user.id
    if ((action === 'ACCEPT' || action === 'REJECT') && offer.userId !== userId) {
      throw createError({ statusCode: 403, message: 'Action non autorisée' })
    }
    if (action === 'CANCEL' && booking.requesterId !== userId) {
      throw createError({ statusCode: 403, message: 'Annulation non autorisée' })
    }

    // Transitions de statut
    if (booking.status !== 'PENDING' && action !== 'CANCEL') {
      throw createError({ statusCode: 400, message: 'Réservation déjà traitée' })
    }

    let newStatus = booking.status
    if (action === 'ACCEPT') {
      // Vérifier capacité restante sur ACCEPT
      const acceptedSeats = offer.bookings
        .filter((b) => b.status === 'ACCEPTED' && b.id !== booking.id)
        .reduce((sum, b) => sum + (b.seats || 0), 0)
      if (acceptedSeats + booking.seats > offer.availableSeats) {
        throw createError({ statusCode: 400, message: 'Plus assez de places disponibles' })
      }
      newStatus = 'ACCEPTED'
    } else if (action === 'REJECT') {
      newStatus = 'REJECTED'
    } else if (action === 'CANCEL') {
      // Annulation par le demandeur, quel que soit l'état (PENDING/ACCEPTED)
      newStatus = 'CANCELLED'
    }

    const updated = await prisma.carpoolBooking.update({
      where: { id: bookingId },
      data: { status: newStatus },
      include: {
        requester: {
          select: userWithProfileSelect,
        },
      },
    })

    // Envoyer notifications selon l'action
    if (action === 'ACCEPT' || action === 'REJECT') {
      const ownerName = offer.user.pseudo || `Utilisateur ${offer.user.id}`

      if (action === 'ACCEPT') {
        await safeNotify(
          () =>
            NotificationHelpers.carpoolBookingAccepted(
              booking.requesterId,
              ownerName,
              offerId,
              booking.seats,
              offer.locationCity,
              offer.tripDate
            ),
          'covoiturage réservation acceptée'
        )
      } else {
        await safeNotify(
          () =>
            NotificationHelpers.carpoolBookingRejected(
              booking.requesterId,
              ownerName,
              offerId,
              booking.seats,
              offer.locationCity
            ),
          'covoiturage réservation refusée'
        )
      }
    } else if (action === 'CANCEL' && booking.status === 'ACCEPTED') {
      const passengerName = updated.requester.pseudo || `Utilisateur ${updated.requester.id}`
      await safeNotify(
        () =>
          NotificationHelpers.carpoolBookingCancelled(
            offer.userId,
            passengerName,
            offerId,
            booking.seats,
            offer.locationCity,
            offer.tripDate
          ),
        'covoiturage réservation annulée'
      )
    }

    return updated
  },
  { operationName: 'UpdateCarpoolBooking' }
)
