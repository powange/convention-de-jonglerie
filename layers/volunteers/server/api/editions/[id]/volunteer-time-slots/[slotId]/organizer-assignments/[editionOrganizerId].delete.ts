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
      select: { id: true },
    })
    if (!timeSlot) {
      throw createError({
        status: 404,
        message: "Créneau non trouvé ou n'appartient pas à cette édition",
      })
    }

    const supprimees = await prisma.organizerSlotAssignment.deleteMany({
      where: { editionOrganizerId, timeSlotId: slotId },
    })
    if (supprimees.count === 0) {
      throw createError({ status: 404, message: 'Affectation introuvable' })
    }

    return createSuccessResponse({ editionOrganizerId, timeSlotId: slotId })
  },
  { operationName: 'DeleteOrganizerSlotAssignment' }
)
