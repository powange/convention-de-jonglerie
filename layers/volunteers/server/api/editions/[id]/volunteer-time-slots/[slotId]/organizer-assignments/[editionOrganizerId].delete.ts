import { notifierRetraitDuCreneau } from '../../../../../../utils/notification-creneau'
import { planningPublieDeLEdition } from '../../../../../../utils/planning-publie'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  validateEditionId,
  validateResourceId,
  validateStringId,
} from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

/**
 * DELETE /api/editions/[id]/volunteer-time-slots/[slotId]/organizer-assignments/[id]
 *
 * Retire un organisateur d'un créneau.
 *
 * Pas de garde sur le réglage `organizersInTeams`, contrairement au POST : refermer l'option ne
 * doit pas enfermer des affectations qu'on ne pourrait plus défaire. Retirer reste toujours
 * possible, ajouter non.
 */
export default wrapApiHandler(
  async (event) => {
    await requireAuth(event)

    const editionId = validateEditionId(event)
    const slotId = validateStringId(event, 'slotId', 'créneau')
    const editionOrganizerId = validateResourceId(event, 'editionOrganizerId', 'organisateur')

    await useVolunteerPorts().organizers.requireManagementAccess(event, editionId)

    // Le créneau doit appartenir à cette édition : la permission porte sur elle, pas sur un
    // identifiant de créneau venu d'ailleurs.
    const timeSlot = await prisma.volunteerTimeSlot.findFirst({
      where: { id: slotId, eventId: editionId },
      // Les dates servent au message de la notification — constat B4.
      select: {
        id: true,
        startDateTime: true,
        endDateTime: true,
        teamId: true,
        delayMinutes: true,
      },
    })
    if (!timeSlot) {
      throw createError({
        status: 404,
        message: "Créneau non trouvé ou n'appartient pas à cette édition",
      })
    }

    /*
     * Le compte à prévenir se lit AVANT la suppression — constat B4.
     *
     * ⚠️ `EditionOrganizer` porte le compte sous `organizerId`, et non `userId` : ce dernier
     * n'existe pas sur ce modèle, et le chercher rendrait `undefined` — donc une notification
     * envoyée à personne, sans erreur.
     */
    const organisateur = await prisma.editionOrganizer.findUnique({
      where: { id: editionOrganizerId },
      select: { organizerId: true },
    })

    const supprimees = await prisma.organizerSlotAssignment.deleteMany({
      where: { editionOrganizerId, timeSlotId: slotId },
    })
    if (supprimees.count === 0) {
      throw createError({ status: 404, message: 'Affectation introuvable' })
    }

    /*
     * Un organisateur posé sur un créneau n'est pas un spectateur : il tient le poste, et le
     * retirer sans le lui dire est le même défaut que pour un bénévole.
     */
    try {
      if (organisateur && (await planningPublieDeLEdition(editionId))) {
        await notifierRetraitDuCreneau({
          editionId,
          userId: organisateur.organizerId,
          creneau: timeSlot,
        })
      }
    } catch (erreur) {
      console.error('[DeleteOrganizerSlotAssignment] notification du retrait impossible :', erreur)
    }

    return createSuccessResponse({ editionOrganizerId, timeSlotId: slotId })
  },
  { operationName: 'DeleteOrganizerSlotAssignment' }
)
