import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { requireVolunteerManagementAccess } from '@@/server/utils/permissions/volunteer-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)
    const slotId = validateResourceId(event, 'slotId', 'créneau')

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
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            nom: true,
            prenom: true,
            email: true,
            profilePicture: true,
            updatedAt: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            pseudo: true,
          },
        },
      },
      orderBy: {
        assignedAt: 'asc',
      },
    })

    // Formater les assignations - gestionnaires ont emailHash pour avatars + email pour contact
    const formattedAssignments = assignments.map((assignment) => ({
      ...assignment,
      user: {
        id: assignment.user.id,
        pseudo: assignment.user.pseudo,
        nom: assignment.user.nom,
        prenom: assignment.user.prenom,
        emailHash: getEmailHash(assignment.user.email),
        email: assignment.user.email,
        profilePicture: assignment.user.profilePicture,
        updatedAt: assignment.user.updatedAt,
      },
    }))

    return formattedAssignments
  },
  { operationName: 'GetVolunteerTimeSlotAssignments' }
)
