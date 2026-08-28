import { avecCoequipiers, coequipiersSelect } from '../../../../utils/coequipiers-creneau'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { infosPersonnelles, infosPersonnellesSelect } from '#server/utils/infos-personnelles'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Récupère la candidature de bénévolat de l'utilisateur connecté pour une édition
 */
export default wrapApiHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Récupérer la candidature de l'utilisateur pour cette édition
  const application = await prisma.editionVolunteerApplication.findUnique({
    where: {
      eventId_userId: {
        eventId: editionId,
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
          ...userWithNameSelect,
          ...infosPersonnellesSelect,
          email: true,
          phone: true,
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
          eventId: editionId,
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
            delayMinutes: true,
            team: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            assignments: coequipiersSelect(user.id),
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
    // Le profil fait foi, ici comme dans la vue des organisateurs. Sans cette résolution,
    // l'intéressé relirait la copie figée dans sa candidature pendant que les organisateurs,
    // eux, verraient son profil à jour — deux vérités pour la même personne.
    ...infosPersonnelles(application.user as never),
    assignedTimeSlots: assignedTimeSlots.map((assignation) => ({
      ...assignation,
      timeSlot: avecCoequipiers(assignation.timeSlot),
    })),
  }
}, 'GetMyVolunteerApplication')
