import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth, requireResourceOwner } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { buildUpdateData } from '#server/utils/prisma-helpers'
import { carpoolOfferInclude } from '#server/utils/prisma-select-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'
import { updateCarpoolOfferSchema } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    requireAuth(event)
    const offerId = validateResourceId(event, 'id', 'offre')

    const body = await readBody(event)

    // Valider les données
    const validatedData = updateCarpoolOfferSchema.parse(body)

    // Vérifier que l'offre existe
    const existingOffer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
      include: {
        user: {
          select: { id: true, pseudo: true },
        },
      },
    })
    if (!existingOffer) {
      throw createError({ status: 404, message: 'Offre de covoiturage introuvable' })
    }

    // Seul le créateur peut modifier son offre
    requireResourceOwner(event, existingOffer, {
      errorMessage: "Vous n'avez pas les droits pour modifier cette offre",
    })

    // Construire les données de mise à jour
    const updateData = buildUpdateData(validatedData, {
      trimStrings: true,
      transform: {
        tripDate: (val) => new Date(val),
      },
    })

    /*
     * Ce qui compte pour un passager déjà inscrit : QUAND et D'OÙ.
     *
     * On ne prévient pas de toute modification. Le nombre de places, le téléphone ou la description
     * ne changent rien à son trajet ; la date et la ville de départ, si. C'est exactement sur ces
     * deux champs qu'un passager non prévenu se présenterait au mauvais endroit, ou le mauvais
     * jour — et il n'aurait aucun moyen de le savoir, puisque rien ne l'avertissait.
     *
     * La comparaison se fait AVANT l'`update`, seul moment où l'ancienne valeur existe encore. La
     * date se compare par son instant : deux `Date` distinctes pour le même moment ne sont pas un
     * changement, et prévenir pour cela apprendrait aux passagers à ignorer ces messages.
     */
    const laDateChange =
      updateData.tripDate instanceof Date &&
      updateData.tripDate.getTime() !== existingOffer.tripDate.getTime()

    const laVilleChange =
      typeof updateData.locationCity === 'string' &&
      updateData.locationCity !== existingOffer.locationCity

    const changementDecisif = laDateChange || laVilleChange

    /*
     * Les réservations sont lues avant l'`update` pour une raison plus simple qu'à la suppression :
     * l'`update` ne les touche pas. Mais les lire ici évite de payer la requête quand rien de
     * décisif n'a changé — le cas de très loin le plus fréquent.
     */
    const reservationsAPrevenir = changementDecisif
      ? await prisma.carpoolBooking.findMany({
          where: {
            carpoolOfferId: offerId,
            // Seuls les ACCEPTÉS : un demandeur en attente n'a pas encore de trajet à réorganiser,
            // et il verra la nouvelle date sur l'offre quand on lui répondra.
            status: 'ACCEPTED',
          },
          select: { requesterId: true },
        })
      : []

    // Mettre à jour l'offre
    const updatedOffer = await prisma.carpoolOffer.update({
      where: { id: offerId },
      data: updateData,
      include: carpoolOfferInclude,
    })

    const nomDuConducteur = existingOffer.user?.pseudo || `Utilisateur ${existingOffer.userId}`

    for (const reservation of reservationsAPrevenir) {
      await safeNotify(
        () =>
          NotificationHelpers.carpoolOfferChanged(
            reservation.requesterId,
            nomDuConducteur,
            offerId,
            existingOffer.editionId,
            // Les NOUVELLES valeurs : la notification dit où en est le trajet, pas d'où il vient.
            updatedOffer.locationCity,
            updatedOffer.tripDate
          ),
        'covoiturage offre modifiée'
      )
    }

    return createSuccessResponse(updatedOffer)
  },
  { operationName: 'UpdateCarpoolOffer' }
)
