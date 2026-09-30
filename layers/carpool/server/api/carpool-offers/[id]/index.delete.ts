import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth, requireResourceOwner } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    requireAuth(event)
    const offerId = validateResourceId(event, 'id', 'offre')

    // Vérifier que l'offre existe et que l'utilisateur en est le créateur
    const existingOffer = await fetchResourceOrFail(prisma.carpoolOffer, offerId, {
      errorMessage: 'Offre de covoiturage introuvable',
      // Le pseudo du conducteur nomme l'auteur de la suppression dans la notification. Le charger
      // ici évite une seconde requête, et surtout évite de le chercher après la suppression — où
      // l'offre n'a plus de relation à suivre.
      include: { user: { select: { id: true, pseudo: true } } },
    })

    // Seul le créateur peut supprimer son offre
    requireResourceOwner(event, existingOffer, {
      errorMessage: "Vous n'avez pas les droits pour supprimer cette offre",
    })

    /*
     * ⚠️ LIRE LES RÉSERVATIONS AVANT LA SUPPRESSION, et ce n'est pas une précaution de style.
     *
     * `CarpoolBooking` est en `onDelete: Cascade` : la ligne de l'offre partie, les réservations
     * n'existent plus. Les relire après serait un tableau vide, et personne ne serait prévenu —
     * ce qui était exactement le comportement précédent. Un passager acceptait une place, puis le
     * conducteur supprimait son offre, et le passager n'apprenait rien : il se présentait au
     * rendez-vous.
     *
     * On prévient les ACCEPTÉS **et** les EN ATTENTE. Un demandeur en attente n'a pas de place,
     * mais il attend une réponse qui ne viendra jamais — et sans notification, il l'attend
     * indéfiniment plutôt que de chercher un autre trajet.
     */
    const reservationsAPrevenir = await prisma.carpoolBooking.findMany({
      where: {
        carpoolOfferId: offerId,
        status: { in: ['ACCEPTED', 'PENDING'] },
      },
      select: { requesterId: true, seats: true },
    })

    // Supprimer l'offre (les commentaires seront supprimés automatiquement grâce à CASCADE)
    await prisma.carpoolOffer.delete({
      where: { id: offerId },
    })

    /*
     * Les notifications partent APRÈS la suppression, et par `safeNotify` : la suppression est ce
     * que l'utilisateur a demandé, elle ne doit pas échouer parce qu'un envoi a raté. L'inverse —
     * prévenir avant de supprimer — annoncerait une disparition qui pourrait ne pas avoir lieu.
     */
    const nomDuConducteur = existingOffer.user?.pseudo || `Utilisateur ${existingOffer.userId}`

    for (const reservation of reservationsAPrevenir) {
      await safeNotify(
        () =>
          NotificationHelpers.carpoolOfferDeleted(
            reservation.requesterId,
            nomDuConducteur,
            existingOffer.editionId,
            reservation.seats,
            existingOffer.locationCity
          ),
        'covoiturage offre supprimée'
      )
    }

    return createSuccessResponse(null, 'Offre de covoiturage supprimée avec succès')
  },
  { operationName: 'DeleteCarpoolOffer' }
)
