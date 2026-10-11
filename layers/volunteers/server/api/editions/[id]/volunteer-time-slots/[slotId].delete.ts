import {
  comptesAffectesAuCreneau,
  notifierCreneauSupprime,
} from '../../../../utils/notification-creneau'
import { planningPublieDeLEdition } from '../../../../utils/planning-publie'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId, validateStringId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

/**
 * DELETE .../volunteer-time-slots/[slotId] — supprime un créneau et ses affectations.
 *
 * 📍 Les sept `console.log` de débogage qui traçaient chaque étape ici ont été retirés : ils
 * écrivaient l'identifiant du créneau et le nombre d'affectations dans les journaux de production
 * à chaque appel, et noyaient les lignes qui comptent.
 */
export default wrapApiHandler(
  async (event) => {
    await requireAuth(event)

    const editionId = validateEditionId(event)
    const slotId = validateStringId(event, 'slotId', 'créneau')

    await useVolunteerPorts().organizers.requireManagementAccess(event, editionId)

    // Vérifier que le créneau existe et appartient à cette édition
    const existingSlot = await prisma.volunteerTimeSlot.findFirst({
      where: { id: slotId, eventId: editionId },
    })

    if (!existingSlot) {
      throw createError({
        status: 404,
        message: "Créneau non trouvé ou n'appartient pas à cette édition",
      })
    }

    /*
     * ⚠️ LES DESTINATAIRES SE LISENT AVANT LA TRANSACTION — constat B4.
     *
     * Elle supprime les affectations (`deleteMany`), et la suppression du créneau emporte en
     * cascade les affectations d'organisateurs. Les lire APRÈS rendrait une liste VIDE : on ne
     * préviendrait personne, tout en AYANT L'AIR corrigé, puisque rien n'échouerait.
     *
     * La lecture est donc ici, l'envoi après le succès de la transaction : annoncer une
     * suppression qui n'a pas eu lieu serait pire que ne rien annoncer.
     */
    let destinataires: number[] = []
    try {
      if (await planningPublieDeLEdition(editionId)) {
        destinataires = await comptesAffectesAuCreneau(slotId)
      }
    } catch (erreur) {
      console.error('[DeleteVolunteerTimeSlot] destinataires illisibles :', erreur)
    }

    // Supprimer le créneau et ses assignations dans une transaction
    await prisma.$transaction([
      prisma.volunteerAssignment.deleteMany({ where: { timeSlotId: slotId } }),
      prisma.volunteerTimeSlot.delete({ where: { id: slotId } }),
    ])

    try {
      await notifierCreneauSupprime({ editionId, destinataires, creneau: existingSlot })
    } catch (erreur) {
      console.error('[DeleteVolunteerTimeSlot] notification de la suppression impossible :', erreur)
    }

    setResponseStatus(event, 204)
    return createSuccessResponse(null)
  },
  { operationName: 'DeleteVolunteerTimeSlot' }
)
