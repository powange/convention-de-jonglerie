import { NotificationHelpers } from '../../../../utils/notification-service'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  const offerId = parseInt(event.context.params?.id as string)
  const bookingId = parseInt(event.context.params?.bookingId as string)
  if (!offerId || !bookingId) {
    throw createError({ statusCode: 400, statusMessage: 'Paramètres invalides' })
  }

  const body = await readBody(event)
  const action = body?.action as 'ACCEPT' | 'REJECT' | 'CANCEL'
  if (!action) {
    throw createError({ statusCode: 400, statusMessage: 'Action manquante' })
  }

  // Récupérer l'offre et la réservation
  const offer = await prisma.carpoolOffer.findUnique({
    where: { id: offerId },
    include: { user: true, bookings: true },
  })
  if (!offer) throw createError({ statusCode: 404, statusMessage: 'Offre introuvable' })

  const booking = await prisma.carpoolBooking.findUnique({ where: { id: bookingId } })
  if (!booking || booking.carpoolOfferId !== offerId) {
    throw createError({ statusCode: 404, statusMessage: 'Réservation introuvable' })
  }

  // Droits:
  // - ACCEPT/REJECT: uniquement le créateur de l'offre
  // - CANCEL: le demandeur de la réservation
  const userId = event.context.user.id
  if ((action === 'ACCEPT' || action === 'REJECT') && offer.userId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Action non autorisée' })
  }
  if (action === 'CANCEL' && booking.requesterId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Annulation non autorisée' })
  }

  // Transitions de statut
  if (booking.status !== 'PENDING' && action !== 'CANCEL') {
    throw createError({ statusCode: 400, statusMessage: 'Réservation déjà traitée' })
  }

  let newStatus = booking.status
  if (action === 'ACCEPT') {
    // Vérifier capacité restante sur ACCEPT
    const acceptedSeats = offer.bookings
      .filter((b) => b.status === 'ACCEPTED' && b.id !== booking.id)
      .reduce((sum, b) => sum + (b.seats || 0), 0)
    if (acceptedSeats + booking.seats > offer.availableSeats) {
      throw createError({ statusCode: 400, statusMessage: 'Plus assez de places disponibles' })
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
        select: { id: true, pseudo: true, profilePicture: true },
      },
    },
  })

  // Envoyer notifications au demandeur selon l'action
  if (action === 'ACCEPT' || action === 'REJECT') {
    try {
      const ownerName = offer.user.pseudo || `Utilisateur ${offer.user.id}`

      if (action === 'ACCEPT') {
        await NotificationHelpers.carpoolBookingAccepted(
          booking.requesterId,
          ownerName,
          offerId,
          booking.seats,
          offer.locationCity,
          offer.tripDate
        )
      } else if (action === 'REJECT') {
        await NotificationHelpers.carpoolBookingRejected(
          booking.requesterId,
          ownerName,
          offerId,
          booking.seats,
          offer.locationCity
        )
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi de la notification de covoiturage:", error)
      // On ne fait pas échouer la mise à jour si la notification échoue
    }
  }

  return updated
})
