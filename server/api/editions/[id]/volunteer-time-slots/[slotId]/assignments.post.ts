import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { requireVolunteerManagementAccess } from '#server/utils/permissions/volunteer-permissions'
import { userBasicSelect, userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validateStringId } from '#server/utils/validation-helpers'

const assignVolunteerSchema = z.object({
  userId: z.number().int().positive(),
})

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)
    const slotId = validateStringId(event, 'slotId', 'créneau')

    // Vérifier les permissions de gestion des bénévoles
    await requireVolunteerManagementAccess(event, editionId)

    // Validation du body
    const body = await readValidatedBody(event, assignVolunteerSchema.parse)

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
        status: 404,
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
        status: 400,
        message: 'Bénévole non trouvé ou candidature non acceptée pour cette édition',
      })
    }

    // Vérifier que le créneau n'est pas déjà complet
    if (timeSlot._count.assignments >= timeSlot.maxVolunteers) {
      throw createError({
        status: 400,
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
        status: 400,
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
            ...userWithNameSelect,
            email: true,
          },
        },
        assignedBy: {
          select: userBasicSelect,
        },
      },
    })

    return {
      message: 'Bénévole assigné avec succès',
      assignment,
    }
  },
  { operationName: 'CreateVolunteerTimeSlotAssignment' }
)
