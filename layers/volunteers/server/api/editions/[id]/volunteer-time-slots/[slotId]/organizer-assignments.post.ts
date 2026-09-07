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
 * Un organisateur **occupe une place** : `maxVolunteers` dit combien de personnes le créneau
 * demande, et il ne distingue pas les titres. Sur un créneau à deux places, un organisateur en
 * prend une, et il ne reste qu'un poste — pour un bénévole ou pour un autre organisateur.
 *
 * La table reste séparée pour autant : ce qui distingue un organisateur, c'est de n'avoir ni
 * candidature, ni échange de créneau, ni part dans l'assignation automatique. Pas la place
 * qu'il occupe.
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
      select: {
        id: true,
        maxVolunteers: true,
        _count: { select: { assignments: true, organizerAssignments: true } },
      },
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

    // Les places se comptent toutes ensemble, bénévoles et organisateurs. Ce contrôle vient
    // après celui du doublon : réaffecter quelqu'un déjà présent sur un créneau plein doit se
    // voir dire « déjà affecté », pas « complet ».
    const placesOccupees = timeSlot._count.assignments + timeSlot._count.organizerAssignments
    if (placesOccupees >= timeSlot.maxVolunteers) {
      throw createError({ status: 400, message: 'Ce créneau est déjà complet' })
    }

    await prisma.organizerSlotAssignment.create({
      data: { editionOrganizerId, timeSlotId: slotId },
    })

    return createSuccessResponse({ editionOrganizerId, timeSlotId: slotId })
  },
  { operationName: 'CreateOrganizerSlotAssignment' }
)
