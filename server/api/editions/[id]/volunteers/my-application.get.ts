import { requireAuth } from '../../../../utils/auth-utils'
import { prisma } from '../../../../utils/prisma'

/**
 * Récupère la candidature de bénévolat de l'utilisateur connecté pour une édition
 */
export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) {
    throw createError({
      statusCode: 400,
      message: 'Edition invalide',
    })
  }

  // Récupérer la candidature de l'utilisateur pour cette édition
  const application = await prisma.editionVolunteerApplication.findUnique({
    where: {
      editionId_userId: {
        editionId,
        userId: user.id,
      },
    },
    select: {
      id: true,
      status: true,
      motivation: true,
      createdAt: true,
      updatedAt: true,
      decidedAt: true,
      dietaryPreference: true,
      allergies: true,
      allergySeverity: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      timePreferences: true,
      teamPreferences: true,
      acceptanceNote: true,
      setupAvailability: true,
      teardownAvailability: true,
      eventAvailability: true,
      arrivalDateTime: true,
      departureDateTime: true,
      hasPets: true,
      petsDetails: true,
      hasMinors: true,
      minorsDetails: true,
      hasVehicle: true,
      vehicleDetails: true,
      companionName: true,
      avoidList: true,
      skills: true,
      hasExperience: true,
      experienceDetails: true,
      userSnapshotPhone: true,
      user: {
        select: {
          id: true,
          pseudo: true,
          email: true,
          phone: true,
          prenom: true,
          nom: true,
        },
      },
      teamAssignments: {
        select: {
          teamId: true,
          isLeader: true,
          assignedAt: true,
          team: {
            select: {
              id: true,
              name: true,
              description: true,
              color: true,
            },
          },
        },
        orderBy: {
          assignedAt: 'asc',
        },
      },
    },
  })

  // Retourner null si pas de candidature (pas d'erreur 404)
  if (!application) {
    return null
  }

  // Récupérer les créneaux assignés si la candidature est acceptée
  let assignedTimeSlots = []
  if (application.status === 'ACCEPTED') {
    assignedTimeSlots = await prisma.volunteerAssignment.findMany({
      where: {
        userId: user.id,
        timeSlot: {
          editionId,
        },
      },
      select: {
        id: true,
        assignedAt: true,
        timeSlot: {
          select: {
            id: true,
            title: true,
            startDateTime: true,
            endDateTime: true,
            team: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: {
        timeSlot: {
          startDateTime: 'asc',
        },
      },
    })
  }

  return {
    ...application,
    assignedTimeSlots,
  }
})
