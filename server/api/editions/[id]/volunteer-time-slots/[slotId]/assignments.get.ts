import { requireAuth } from '../../../../../utils/auth-utils'
import { prisma } from '../../../../../utils/prisma'
import { requireVolunteerManagementAccess } from '../../../../../utils/volunteer-permissions'

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)
  const slotId = getRouterParam(event, 'slotId') as string

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'édition invalide",
    })
  }

  if (!slotId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID de créneau invalide',
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
        statusMessage: "Créneau non trouvé ou n'appartient pas à cette édition",
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

    return assignments
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des assignations',
    })
  }
})
