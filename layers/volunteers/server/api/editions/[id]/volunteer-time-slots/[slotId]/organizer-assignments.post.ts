import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId, validateStringId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

const bodySchema = z.object({
  editionOrganizerId: z.number().int().positive(),
})

/**
 * POST /api/editions/[id]/volunteer-time-slots/[slotId]/organizer-assignments
 *
 * Affecte un organisateur de l'édition à un créneau de bénévolat.
 *
 * **Aucun contrôle de capacité, volontairement** : `maxVolunteers` compte les bénévoles, et un
 * organisateur n'en est pas un. Un créneau complet accepte donc un organisateur, et l'y placer
 * ne prend la place de personne. C'est le pendant du choix de table séparée.
 */
export default wrapApiHandler(
  async (event) => {
    await requireAuth(event)

    const editionId = validateEditionId(event)
    const slotId = validateStringId(event, 'slotId', 'créneau')

    await useVolunteerPorts().organizers.requireManagementAccess(event, editionId)

    // L'option doit être ouverte sur l'édition, comme pour le rattachement aux équipes.
    const settings = await prisma.eventVolunteerSettings.findUnique({
      where: { eventId: editionId },
      select: { organizersInTeams: true },
    })
    if (!settings?.organizersInTeams) {
      throw createError({
        status: 403,
        message: "L'option « organisateurs dans les équipes » est désactivée sur cette édition",
      })
    }

    const { editionOrganizerId } = bodySchema.parse(await readBody(event))

    // Créneau et organisateur doivent tous deux appartenir à CETTE édition : sans ces
    // contrôles, un identifiant emprunté à une édition voisine passerait la permission de
    // celle-ci.
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

    const editionOrganizer = await prisma.editionOrganizer.findFirst({
      where: { id: editionOrganizerId, editionId },
      select: { id: true },
    })
    if (!editionOrganizer) {
      throw createError({ status: 404, message: 'Organisateur introuvable sur cette édition' })
    }

    const dejaAffecte = await prisma.organizerSlotAssignment.findUnique({
      where: { editionOrganizerId_timeSlotId: { editionOrganizerId, timeSlotId: slotId } },
      select: { timeSlotId: true },
    })
    if (dejaAffecte) {
      throw createError({
        status: 400,
        message: 'Cet organisateur est déjà affecté à ce créneau',
      })
    }

    await prisma.organizerSlotAssignment.create({
      data: { editionOrganizerId, timeSlotId: slotId },
    })

    return createSuccessResponse({ editionOrganizerId, timeSlotId: slotId })
  },
  { operationName: 'CreateOrganizerSlotAssignment' }
)
