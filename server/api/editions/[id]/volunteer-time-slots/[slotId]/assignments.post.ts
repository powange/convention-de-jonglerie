import { z } from 'zod'

import { requireAuth } from '../../../../../utils/auth-utils'
import { prisma } from '../../../../../utils/prisma'
import { requireVolunteerManagementAccess } from '../../../../../utils/volunteer-permissions'

const assignVolunteerSchema = z.object({
  userId: z.number().int().positive(),
})

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

  // Validation du body
  const body = await readValidatedBody(event, assignVolunteerSchema.parse)

  try {
    // Vérifier que le créneau existe et appartient à cette édition
    const timeSlot = await prisma.volunteerTimeSlot.findFirst({
      where: {
        id: slotId,
        editionId,
      },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    })

    if (!timeSlot) {
      throw createError({
        statusCode: 404,
        message: "Créneau non trouvé ou n'appartient pas à cette édition",
      })
    }

    // Vérifier que le bénévole a une candidature acceptée pour cette édition
    const application = await prisma.editionVolunteerApplication.findFirst({
      where: {
        userId: body.userId,
        editionId,
        status: 'ACCEPTED',
      },
    })

    if (!application) {
      throw createError({
        statusCode: 400,
        message: 'Bénévole non trouvé ou candidature non acceptée pour cette édition',
      })
    }

    // Vérifier que le créneau n'est pas déjà complet
    if (timeSlot._count.assignments >= timeSlot.maxVolunteers) {
      throw createError({
        statusCode: 400,
        message: 'Ce créneau est déjà complet',
      })
    }

    // Vérifier que le bénévole n'est pas déjà assigné à ce créneau
    const existingAssignment = await prisma.volunteerAssignment.findUnique({
      where: {
        timeSlotId_userId: {
          timeSlotId: slotId,
          userId: body.userId,
        },
      },
    })

    if (existingAssignment) {
      throw createError({
        statusCode: 400,
        message: 'Ce bénévole est déjà assigné à ce créneau',
      })
    }

    // Créer l'assignation
    const assignment = await prisma.volunteerAssignment.create({
      data: {
        timeSlotId: slotId,
        userId: body.userId,
        assignedById: event.context.user!.id,
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
    })

    return {
      message: 'Bénévole assigné avec succès',
      assignment,
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Erreur lors de l'assignation du bénévole",
    })
  }
})
