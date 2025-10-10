import { requireAuth } from '../../../../utils/auth-utils'
import { getEmailHash } from '../../../../utils/email-hash'
import { requireVolunteerManagementAccess } from '../../../../utils/permissions/volunteer-permissions'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
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
            profilePicture: true,
            updatedAt: true,
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
        teamAssignments: {
          select: {
            team: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
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

    // Transformer les données pour l'interface - gestionnaires ont emailHash pour avatars + email pour contact
    const formattedVolunteers = availableVolunteers.map((application) => ({
      applicationId: application.id,
      userId: application.userId,
      pseudo: application.user.pseudo,
      nom: application.user.nom,
      prenom: application.user.prenom,
      emailHash: getEmailHash(application.user.email),
      email: application.user.email,
      profilePicture: application.user.profilePicture,
      updatedAt: application.user.updatedAt,
      teamPreferences: application.teamPreferences,
      assignedTeams: application.teamAssignments.map((assignment) => assignment.team.id), // Convertir les teamAssignments en array d'IDs
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
      message: 'Erreur lors de la récupération des bénévoles disponibles',
    })
  }
})
