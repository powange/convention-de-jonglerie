import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { requireVolunteerManagementAccess } from '@@/server/utils/permissions/volunteer-permissions'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const createTimeSlotSchema = z
  .object({
    title: z.string().max(200).nullable(),
    description: z.string().optional(),
    teamId: z.string().optional(),
    startDateTime: z.string().transform((str) => new Date(str)),
    endDateTime: z.string().transform((str) => new Date(str)),
    maxVolunteers: z.number().int().min(1).max(50),
  })
  .refine((data) => data.endDateTime > data.startDateTime, {
    message: 'La date de fin doit être postérieure à la date de début',
    path: ['endDateTime'],
  })

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)

    // Vérifier les permissions de gestion des bénévoles
    await requireVolunteerManagementAccess(event, editionId)

    // Validation du body
    const body = await readValidatedBody(event, createTimeSlotSchema.parse)

    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
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

    // Vérifier que les dates sont dans la période de l'édition (incluant montage/démontage)
    // Utilise les dates de montage/démontage si définies, sinon les dates de l'édition
    const editionStart = edition.volunteersSetupStartDate
      ? new Date(edition.volunteersSetupStartDate)
      : new Date(edition.startDate)
    const editionEnd = edition.volunteersTeardownEndDate
      ? new Date(edition.volunteersTeardownEndDate)
      : new Date(edition.endDate)

    // Ajouter un jour à la date de fin pour inclure tout le dernier jour (jusqu'à 23:59:59)
    editionEnd.setDate(editionEnd.getDate() + 1)

    if (body.startDateTime < editionStart || body.endDateTime > editionEnd) {
      throw createError({
        statusCode: 400,
        message: "Le créneau doit être dans la période de l'édition",
      })
    }

    // Créer le créneau
    const timeSlot = await prisma.volunteerTimeSlot.create({
      data: {
        editionId,
        teamId: body.teamId || null,
        title: body.title,
        description: body.description,
        startDateTime: body.startDateTime,
        endDateTime: body.endDateTime,
        maxVolunteers: body.maxVolunteers,
      },
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

    setResponseStatus(event, 201)
    return formattedTimeSlot
  },
  { operationName: 'CreateVolunteerTimeSlot' }
)
