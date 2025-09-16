import { requireAuth } from '../../../../utils/auth-utils'
import { prisma } from '../../../../utils/prisma'
import { requireVolunteerManagementAccess } from '../../../../utils/volunteer-permissions'

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

  try {
    // Récupérer les créneaux de bénévoles pour cette édition
    const timeSlots = await prisma.volunteerTimeSlot.findMany({
      where: {
        editionId,
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
                email: true,
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
      orderBy: {
        startDateTime: 'asc',
      },
    })

    // Transformer les données pour être compatibles avec FullCalendar
    const formattedTimeSlots = timeSlots.map((slot) => ({
      id: slot.id,
      title: slot.title,
      description: slot.description,
      start: slot.startDateTime.toISOString(),
      end: slot.endDateTime.toISOString(),
      teamId: slot.teamId,
      team: slot.team,
      maxVolunteers: slot.maxVolunteers,
      assignedVolunteers: slot._count.assignments,
      assignments: slot.assignments,
      color: slot.team?.color || '#6b7280',
      resourceId: slot.teamId || 'unassigned',
    }))

    return formattedTimeSlots
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des créneaux de bénévoles',
    })
  }
})
