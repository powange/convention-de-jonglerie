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
    const offer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
      include: {
        user: true,
        bookings: true,
      },
    })
    if (!offer) {
      throw createError({ status: 404, message: 'Offre de covoiturage introuvable' })
    }

    /*
     * ⚠️ ON NE RÉSERVE PAS UN TRAJET DÉJÀ PARTI.
     *
     * Le handler ne regardait pas `tripDate`. La liste des offres filtre bien sur `tripDate >= now`,
     * mais l'option « Afficher tout » les ramène : une offre passée restait donc **réservable**, le
     * formulaire n'étant gardé que par les places restantes. Le conducteur recevait une
     * notification pour un trajet terminé, et le passager croyait avoir réservé.
     *
     * 📍 Pas de tolérance ici, contrairement à la CRÉATION d'une offre : on peut légitimement
     * publier un trajet qui part dans l'heure, mais demander une place sur un trajet dont l'heure
     * est passée n'a plus d'objet — c'est au conducteur qu'il faut écrire.
     */
    if (offer.tripDate.getTime() < Date.now()) {
      throw createError({
        status: 400,
        message: 'Ce trajet est déjà passé : vous ne pouvez plus y réserver de place.',
      })
    }

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

    /*
     * ⚠️ UNE SEULE RÉSERVATION VIVANTE PAR PASSAGER, EN ATTENTE **OU** ACCEPTÉE.
     *
     * La garde ne regardait que `PENDING` : un passager déjà ACCEPTÉ pouvait en déposer une
     * seconde, et il comptait alors DEUX FOIS dans les places du conducteur — une place accordée
     * plus une demande en attente pour la même personne.
     *
     * 📍 `REJECTED` et `CANCELLED` ne bloquent pas, et c'est voulu : une demande refusée ou annulée
     * n'occupe rien, et il est légitime de redemander — le conducteur a peut-être libéré une place
     * depuis, ou le passager s'était désisté puis se ravise.
     */
    const reservationVivante = await prisma.carpoolBooking.findFirst({
      where: {
        carpoolOfferId: offerId,
        requesterId: user.id,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      select: { id: true, status: true },
    })
    if (reservationVivante) {
      throw createError({
        status: 400,
        message:
          reservationVivante.status === 'ACCEPTED'
            ? 'Vous avez déjà une place sur ce trajet'
            : 'Une réservation en attente existe déjà',
      })
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
