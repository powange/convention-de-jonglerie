import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { NotificationHelpers } from '@@/server/utils/notification-service'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const offerId = validateResourceId(event, 'id', 'offre')

    const body = await readBody(event)
    const seats = Number(body?.seats)
    const message = typeof body?.message === 'string' ? body.message.trim() : undefined
    const requestId = body?.requestId ? Number(body.requestId) : undefined

    if (!seats || seats < 1 || seats > 8) {
      throw createError({ statusCode: 400, message: 'Nombre de places invalide' })
    }

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
        statusCode: 400,
        message: 'Impossible de réserver votre propre offre',
      })
    }

    // Si requestId fourni, vérifier l'existence et l'appartenance à l'utilisateur courant
    if (requestId) {
      const req = await fetchResourceOrFail(prisma.carpoolRequest, requestId, {
        errorMessage: 'Demande invalide',
      })
      if (req.userId !== user.id || req.editionId !== offer.editionId) {
        throw createError({ statusCode: 400, message: 'Demande invalide' })
      }
    }

    // Calculer les places déjà acceptées
    const acceptedSeats = offer.bookings
      .filter((b) => b.status === 'ACCEPTED')
      .reduce((sum, b) => sum + (b.seats || 0), 0)

    if (acceptedSeats + seats > offer.availableSeats) {
      throw createError({ statusCode: 400, message: 'Plus assez de places disponibles' })
    }

    // Option: éviter multi-PENDING du même utilisateur sur la même offre
    const existingPending = await prisma.carpoolBooking.findFirst({
      where: { carpoolOfferId: offerId, requesterId: user.id, status: 'PENDING' },
    })
    if (existingPending) {
      throw createError({ statusCode: 400, message: 'Une réservation en attente existe déjà' })
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
        requester: { select: { id: true, pseudo: true, profilePicture: true } },
      },
    })

    // Envoyer une notification au propriétaire de l'offre
    try {
      const requesterName = booking.requester.pseudo || `Utilisateur ${booking.requester.id}`
      await NotificationHelpers.carpoolBookingReceived(
        offer.userId,
        requesterName,
        offerId,
        seats,
        message
      )
    } catch (error) {
      console.error("Erreur lors de l'envoi de la notification de covoiturage:", error)
      // On ne fait pas échouer la création du booking si la notification échoue
    }

    return booking
  },
  { operationName: 'CreateCarpoolOfferBooking' }
)
