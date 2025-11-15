import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { requireVolunteerManagementAccess } from '@@/server/utils/permissions/volunteer-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId, validateStringId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const updateTimeSlotSchema = z
  .object({
    title: z.string().max(200).nullable().optional(),
    description: z.string().optional(),
    teamId: z.string().nullable().optional(),
    startDateTime: z
      .string()
      .transform((str) => new Date(str))
      .optional(),
    endDateTime: z
      .string()
      .transform((str) => new Date(str))
      .optional(),
    maxVolunteers: z.number().int().min(1).max(50).optional(),
    delayMinutes: z.number().int().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.startDateTime && data.endDateTime) {
        return data.endDateTime > data.startDateTime
      }
      return true
    },
    {
      message: 'La date de fin doit être postérieure à la date de début',
      path: ['endDateTime'],
    }
  )

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
    const body = await readValidatedBody(event, updateTimeSlotSchema.parse)

    // Vérifier que le créneau existe et appartient à cette édition
    const existingSlot = await prisma.volunteerTimeSlot.findFirst({
      where: {
        id: slotId,
        editionId,
      },
    })

    if (!existingSlot) {
      throw createError({
        statusCode: 404,
        message: "Créneau non trouvé ou n'appartient pas à cette édition",
      })
    }

    // Vérifier que l'équipe existe (si spécifiée)
    if (body.teamId) {
      const team = await prisma.volunteerTeam.findFirst({
        where: {
          id: body.teamId,
          editionId,
        },
      })

      if (!team) {
        throw createError({
          statusCode: 400,
          message: "Équipe non trouvée ou n'appartient pas à cette édition",
        })
      }
    }

    // Vérifier que les dates sont dans la période de l'édition (si modifiées)
    if (body.startDateTime || body.endDateTime) {
      const edition = await prisma.edition.findUnique({
        where: { id: editionId },
      })

      if (!edition) {
        throw createError({
          statusCode: 404,
          message: 'Édition non trouvée',
        })
      }

      // Utilise les dates de montage/démontage si définies, sinon les dates de l'édition
      const editionStart = edition.volunteersSetupStartDate
        ? new Date(edition.volunteersSetupStartDate)
        : new Date(edition.startDate)
      const editionEnd = edition.volunteersTeardownEndDate
        ? new Date(edition.volunteersTeardownEndDate)
        : new Date(edition.endDate)

      // Ajouter un jour à la date de fin pour inclure tout le dernier jour (jusqu'à 23:59:59)
      editionEnd.setDate(editionEnd.getDate() + 1)

      const newStartDateTime = body.startDateTime || existingSlot.startDateTime
      const newEndDateTime = body.endDateTime || existingSlot.endDateTime

      if (newStartDateTime < editionStart || newEndDateTime > editionEnd) {
        throw createError({
          statusCode: 400,
          message: "Le créneau doit être dans la période de l'édition",
        })
      }
    }

    // Mise à jour du créneau
    const updateData: any = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.teamId !== undefined) updateData.teamId = body.teamId
    if (body.startDateTime !== undefined) updateData.startDateTime = body.startDateTime
    if (body.endDateTime !== undefined) updateData.endDateTime = body.endDateTime
    if (body.maxVolunteers !== undefined) updateData.maxVolunteers = body.maxVolunteers
    if (body.delayMinutes !== undefined) updateData.delayMinutes = body.delayMinutes

    const timeSlot = await prisma.volunteerTimeSlot.update({
      where: { id: slotId },
      data: updateData,
      include: {
        team: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                nom: true,
                prenom: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    })

    // Transformer les données pour être compatibles avec FullCalendar
    const formattedTimeSlot = {
      id: timeSlot.id,
      title: timeSlot.title,
      description: timeSlot.description,
      start: timeSlot.startDateTime.toISOString(),
      end: timeSlot.endDateTime.toISOString(),
      teamId: timeSlot.teamId,
      team: timeSlot.team,
      maxVolunteers: timeSlot.maxVolunteers,
      assignedVolunteers: timeSlot._count.assignments,
      assignments: timeSlot.assignments,
      color: timeSlot.team?.color || '#6b7280',
      resourceId: timeSlot.teamId || 'unassigned',
    }

    return formattedTimeSlot
  },
  { operationName: 'UpdateVolunteerTimeSlot' }
)
