import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { requireVolunteerManagementAccess } from '@@/server/utils/permissions/volunteer-permissions'
import { userBasicSelect } from '@@/server/utils/prisma-select-helpers'
import { validateEditionId, validateStringId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)
    const slotId = validateStringId(event, 'slotId', 'créneau')
    const assignmentId = validateStringId(event, 'assignmentId', 'assignation')

    // Vérifier les permissions de gestion des bénévoles
    await requireVolunteerManagementAccess(event, editionId)

    // Vérifier que l'assignation existe et appartient à ce créneau/édition
    const assignment = await prisma.volunteerAssignment.findFirst({
      where: {
        id: assignmentId,
        timeSlotId: slotId,
        timeSlot: {
          editionId,
        },
      },
      include: {
        user: {
          select: userBasicSelect,
        },
      },
    })

    if (!assignment) {
      throw createError({
        status: 404,
        message: 'Assignation non trouvée',
      })
    }

    // Supprimer l'assignation
    await prisma.volunteerAssignment.delete({
      where: {
        id: assignmentId,
      },
    })

    return {
      message: 'Assignation supprimée avec succès',
      unassignedUser: assignment.user,
    }
  },
  { operationName: 'DeleteVolunteerTimeSlotAssignment' }
)
