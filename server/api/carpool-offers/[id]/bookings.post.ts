import { NotificationHelpers } from '../../../utils/notification-service'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, message: 'Non authentifié' })
  }

  const offerId = parseInt(event.context.params?.id as string)
  if (!offerId) {
    throw createError({ statusCode: 400, message: "ID de l'offre invalide" })
  }

  const body = await readBody(event)
  const seats = Number(body?.seats)
  const message = typeof body?.message === 'string' ? body.message.trim() : undefined
  const requestId = body?.requestId ? Number(body.requestId) : undefined

  if (!seats || seats < 1 || seats > 8) {
    throw createError({ statusCode: 400, message: 'Nombre de places invalide' })
  }

  // Récupérer l'offre et vérifier droits/capacité
  const offer = await prisma.carpoolOffer.findUnique({
    where: { id: offerId },
    include: {
      user: true,
      bookings: true,
    },
  })

  if (!offer) {
    throw createError({ statusCode: 404, message: 'Offre de covoiturage introuvable' })
  }

  // Le créateur ne peut pas réserver sur sa propre offre
  if (offer.userId === event.context.user.id) {
    throw createError({
      statusCode: 400,
      message: 'Impossible de réserver votre propre offre',
    })
  }

  // Si requestId fourni, vérifier l'existence et l'appartenance à l'utilisateur courant
  if (requestId) {
    const req = await prisma.carpoolRequest.findUnique({ where: { id: requestId } })
    if (!req || req.userId !== event.context.user.id || req.editionId !== offer.editionId) {
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
    where: { carpoolOfferId: offerId, requesterId: event.context.user.id, status: 'PENDING' },
  })
  if (existingPending) {
    throw createError({ statusCode: 400, message: 'Une réservation en attente existe déjà' })
  }

  const booking = await prisma.carpoolBooking.create({
    data: {
      carpoolOfferId: offerId,
      requesterId: event.context.user.id,
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
})
