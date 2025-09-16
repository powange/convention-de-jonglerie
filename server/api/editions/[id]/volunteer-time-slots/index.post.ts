import { z } from 'zod'

import { requireAuth } from '../../../../utils/auth-utils'
import { prisma } from '../../../../utils/prisma'
import { requireVolunteerManagementAccess } from '../../../../utils/volunteer-permissions'

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

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'édition invalide",
    })
  }

  // Vérifier les permissions de gestion des bénévoles
  await requireVolunteerManagementAccess(event, editionId)

  // Validation du body
  const body = await readValidatedBody(event, createTimeSlotSchema.parse)

  try {
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Édition non trouvée',
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
          statusMessage: "Équipe non trouvée ou n'appartient pas à cette édition",
        })
      }
    }

    // Vérifier que les dates sont dans la période de l'édition
    const editionStart = new Date(edition.startDate)
    const editionEnd = new Date(edition.endDate)

    if (body.startDateTime < editionStart || body.endDateTime > editionEnd) {
      throw createError({
        statusCode: 400,
        statusMessage: "Le créneau doit être dans la période de l'édition",
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
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la création du créneau',
    })
  }
})
