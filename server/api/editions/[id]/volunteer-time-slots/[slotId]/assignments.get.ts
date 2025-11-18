import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { requireVolunteerManagementAccess } from '@@/server/utils/permissions/volunteer-permissions'
import { prisma } from '@@/server/utils/prisma'
import { volunteerAssignmentDetailedInclude } from '@@/server/utils/prisma-select-helpers'
import { validateEditionId, validateStringId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)
    const slotId = validateStringId(event, 'slotId', 'créneau')

    // Vérifier les permissions de gestion des bénévoles
    await requireVolunteerManagementAccess(event, editionId)

    // Vérifier que le créneau existe et appartient à cette édition
    const timeSlot = await prisma.volunteerTimeSlot.findFirst({
      where: {
        id: slotId,
        editionId,
      },
    })

    if (!timeSlot) {
      throw createError({
        statusCode: 404,
        message: "Créneau non trouvé ou n'appartient pas à cette édition",
      })
    }

    // Récupérer les assignations du créneau
    const assignments = await prisma.volunteerAssignment.findMany({
      where: {
        timeSlotId: slotId,
      },
      include: volunteerAssignmentDetailedInclude,
      orderBy: {
        assignedAt: 'asc',
      },
    })

    return assignments
  },
  { operationName: 'GetVolunteerTimeSlotAssignments' }
)
