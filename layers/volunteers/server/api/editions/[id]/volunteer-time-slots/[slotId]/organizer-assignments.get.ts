import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId, validateStringId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

/**
 * GET /api/editions/[id]/volunteer-time-slots/[slotId]/organizer-assignments
 *
 * Les organisateurs affectés à un créneau. Endpoint séparé de `assignments.get` plutôt qu'un
 * champ ajouté à sa réponse : celle-ci est un tableau nu d'affectations de bénévoles, que
 * plusieurs écrans consomment tel quel.
 */
export default wrapApiHandler(
  async (event) => {
    await requireAuth(event)

    const editionId = validateEditionId(event)
    const slotId = validateStringId(event, 'slotId', 'créneau')

    await useVolunteerPorts().organizers.requireManagementAccess(event, editionId)

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

    const affectations = await prisma.organizerSlotAssignment.findMany({
      where: { timeSlotId: slotId },
      orderBy: { assignedAt: 'asc' },
      select: {
        assignedAt: true,
        editionOrganizer: {
          select: {
            id: true,
            organizer: {
              select: {
                user: {
                  select: {
                    id: true,
                    pseudo: true,
                    prenom: true,
                    nom: true,
                    emailHash: true,
                    profilePicture: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return createSuccessResponse({
      assignments: affectations.map((affectation) => ({
        editionOrganizerId: affectation.editionOrganizer.id,
        assignedAt: affectation.assignedAt,
        user: affectation.editionOrganizer.organizer.user,
      })),
    })
  },
  { operationName: 'GetOrganizerSlotAssignments' }
)
