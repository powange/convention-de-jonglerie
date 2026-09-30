import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { userWithProfileSelect } from '#server/utils/prisma-select-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'

/**
 * Les trois actions, et rien d'autre.
 *
 * `z.enum` plutôt qu'un test de présence : une valeur inconnue doit produire un 400 qui le dit, et
 * non un 200 sur une réservation qu'on n'a pas touchée.
 */
const corpsSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT', 'CANCEL']),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const offerId = validateResourceId(event, 'id', 'offre')
    const bookingId = validateResourceId(event, 'bookingId', 'demande')

    /*
     * ⚠️ Une action INCONNUE renvoyait la réservation inchangée, en 200.
     *
     * L'ancien contrôle ne refusait que l'absence d'action. Une valeur comme « DECLINE » passait
     * donc, `newStatus` restait égal au statut courant, et l'`update` réécrivait la même valeur :
     * l'appelant recevait un succès et une réservation intacte, sans jamais savoir que son action
     * n'existait pas. Le plus trompeur des échecs est celui qui répond 200.
     */
    const { action } = corpsSchema.parse(await readBody(event))

    // Récupérer l'offre et la réservation
    const offer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
      include: { user: true, bookings: true },
    })
    if (!offer) {
      throw createError({ status: 404, message: 'Offre introuvable' })
    }

    const booking = await fetchResourceOrFail(prisma.carpoolBooking, bookingId, {
      errorMessage: 'Réservation introuvable',
    })
    if (booking.carpoolOfferId !== offerId) {
      throw createError({ status: 404, message: 'Réservation introuvable' })
    }

    // Droits:
    // - ACCEPT/REJECT: uniquement le créateur de l'offre
    // - CANCEL: le demandeur de la réservation
    const userId = user.id
    if ((action === 'ACCEPT' || action === 'REJECT') && offer.userId !== userId) {
      throw createError({ status: 403, message: 'Action non autorisée' })
    }
    if (action === 'CANCEL' && booking.requesterId !== userId) {
      throw createError({ status: 403, message: 'Annulation non autorisée' })
    }

    /*
     * Transitions autorisées :
     *
     * - ACCEPT  : depuis PENDING seulement. Accepter deux fois n'a pas de sens, et ré-accepter un
     *             refus effacerait la décision du conducteur sans trace.
     * - REJECT  : depuis PENDING **ou ACCEPTED**. C'est ce que ce lot ajoute — le conducteur ne
     *             pouvait pas retirer quelqu'un qu'il avait accepté, alors que sa voiture peut
     *             tomber en panne ou perdre une place. Il ne lui restait qu'à supprimer l'offre
     *             entière, ce qui prévient tout le monde pour retirer une personne.
     * - CANCEL  : depuis n'importe quel état, par le demandeur seul.
     *
     * ⚠️ REJECTED et non CANNCELLED pour le retrait par le conducteur, et c'est un choix : CANCELLED
     * est le geste du DEMANDEUR (« j'annule ma demande »), REJECTED celui du CONDUCTEUR. Les
     * confondre ferait lire « annulé » au passager dans sa propre liste, comme s'il s'était
     * désisté — on lui attribuerait une décision qui n'est pas la sienne.
     */
    const retraitParLeConducteur = action === 'REJECT' && booking.status === 'ACCEPTED'

    if (action === 'ACCEPT' && booking.status !== 'PENDING') {
      throw createError({ status: 400, message: 'Réservation déjà traitée' })
    }
    if (action === 'REJECT' && booking.status !== 'PENDING' && booking.status !== 'ACCEPTED') {
      throw createError({ status: 400, message: 'Réservation déjà traitée' })
    }

    let newStatus = booking.status
    if (action === 'REJECT') {
      newStatus = 'REJECTED'
    } else if (action === 'CANCEL') {
      // Annulation par le demandeur, quel que soit l'état (PENDING/ACCEPTED)
      newStatus = 'CANCELLED'
    }

    let updated
    if (action === 'ACCEPT') {
      // Transaction avec verrouillage pessimiste pour éviter les race conditions sur la capacité
      updated = await prisma.$transaction(async (tx) => {
        // Verrouiller l'offre pour sérialiser les acceptations concurrentes
        await tx.$queryRaw`SELECT id FROM CarpoolOffer WHERE id = ${offerId} FOR UPDATE`

        // Re-vérifier la capacité sous verrou
        const currentBookings = await tx.carpoolBooking.findMany({
          where: {
            carpoolOfferId: offerId,
            status: 'ACCEPTED',
            id: { not: bookingId },
          },
          select: { seats: true },
        })

        const acceptedSeats = currentBookings.reduce((sum, b) => sum + (b.seats || 0), 0)
        if (acceptedSeats + booking.seats > offer.availableSeats) {
          throw createError({ status: 400, message: 'Plus assez de places disponibles' })
        }

        return tx.carpoolBooking.update({
          where: { id: bookingId },
          data: { status: 'ACCEPTED' },
          include: {
            requester: {
              select: userWithProfileSelect,
            },
          },
        })
      })
    } else {
      updated = await prisma.carpoolBooking.update({
        where: { id: bookingId },
        data: { status: newStatus },
        include: {
          requester: {
            select: userWithProfileSelect,
          },
        },
      })
    }

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
      } else if (retraitParLeConducteur) {
        /*
         * Un RETRAIT, pas un refus. Le passager avait une place et l'organisait : lui envoyer
         * « votre demande a été refusée » serait faux, et lui laisserait croire qu'il n'en avait
         * jamais eu. La distinction ne coûte qu'un message, et c'est le seul endroit où elle se
         * voit.
         */
        await safeNotify(
          () =>
            NotificationHelpers.carpoolBookingRevoked(
              booking.requesterId,
              ownerName,
              offerId,
              booking.seats,
              offer.locationCity
            ),
          'covoiturage place retirée'
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

    return createSuccessResponse(updated)
  },
  { operationName: 'UpdateCarpoolBooking' }
)
