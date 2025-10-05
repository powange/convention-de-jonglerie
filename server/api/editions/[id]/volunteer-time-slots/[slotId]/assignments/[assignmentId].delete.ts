import { requireAuth } from '../../../../../../utils/auth-utils'
import { requireVolunteerManagementAccess } from '../../../../../../utils/permissions/volunteer-permissions'
import { prisma } from '../../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)
  const slotId = getRouterParam(event, 'slotId') as string
  const assignmentId = getRouterParam(event, 'assignmentId') as string

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  if (!slotId) {
    throw createError({
      statusCode: 400,
      message: 'ID de créneau invalide',
    })
  }

  if (!assignmentId) {
    throw createError({
      statusCode: 400,
      message: "ID d'assignation invalide",
    })
  }

  // Vérifier les permissions de gestion des bénévoles
  await requireVolunteerManagementAccess(event, editionId)

  try {
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
          select: {
            id: true,
            pseudo: true,
          },
        },
      },
    })

    if (!assignment) {
      throw createError({
        statusCode: 404,
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
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Erreur lors de la suppression de l'assignation",
    })
  }
})
