import { requireAuth } from '../../../../../utils/auth-utils'
import { getEmailHash } from '../../../../../utils/email-hash'
import { requireVolunteerManagementAccess } from '../../../../../utils/permissions/volunteer-permissions'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)
  const slotId = getRouterParam(event, 'slotId') as string

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

  // Vérifier les permissions de gestion des bénévoles
  await requireVolunteerManagementAccess(event, editionId)

  try {
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
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des assignations',
    })
  }
})
