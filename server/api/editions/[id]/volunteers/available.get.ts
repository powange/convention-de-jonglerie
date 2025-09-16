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
    // Récupérer tous les bénévoles avec candidature acceptée pour cette édition
    const availableVolunteers = await prisma.editionVolunteerApplication.findMany({
      where: {
        editionId,
        status: 'ACCEPTED',
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            pseudo: true,
            nom: true,
            prenom: true,
            email: true,
            volunteerAssignments: {
              where: {
                timeSlot: {
                  editionId,
                },
              },
              select: {
                id: true,
                timeSlotId: true,
                assignedAt: true,
                timeSlot: {
                  select: {
                    id: true,
                    title: true,
                    startDateTime: true,
                    endDateTime: true,
                  },
                },
              },
            },
          },
        },
        teamPreferences: true,
        teams: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        timePreferences: true,
        skills: true,
      },
      orderBy: {
        user: {
          pseudo: 'asc',
        },
      },
    })

    // Transformer les données pour l'interface
    const formattedVolunteers = availableVolunteers.map((application) => ({
      applicationId: application.id,
      userId: application.userId,
      pseudo: application.user.pseudo,
      nom: application.user.nom,
      prenom: application.user.prenom,
      email: application.user.email,
      teamPreferences: application.teamPreferences,
      assignedTeams: application.teams.map((team) => team.id), // Convertir les objets teams en array d'IDs
      timePreferences: application.timePreferences,
      skills: application.skills,
      currentAssignments: application.user.volunteerAssignments,
      assignmentsCount: application.user.volunteerAssignments.length,
    }))

    return formattedVolunteers
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des bénévoles disponibles',
    })
  }
})
