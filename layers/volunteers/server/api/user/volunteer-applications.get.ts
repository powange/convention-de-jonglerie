import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const applications = await prisma.editionVolunteerApplication.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        status: true,
        motivation: true,
        createdAt: true,
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        timePreferences: true,
        teamPreferences: true,
        acceptanceNote: true,
        teamAssignments: {
          select: {
            teamId: true,
            isLeader: true,
            team: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
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
        event: {
          select: {
            // Étape 0bis : la config bénévole (askX) vient d'EventVolunteerSettings
            volunteerSettings: true,
            edition: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                city: true,
                country: true,
                imageUrl: true,
                convention: {
                  select: {
                    id: true,
                    name: true,
                    logo: true,
                  },
                },
              },
            },
            volunteerTeams: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Récupérer les éditions des candidatures acceptées pour chercher les créneaux assignés
    const acceptedApplications = applications.filter((app) => app.status === 'ACCEPTED')
    const editionIds = acceptedApplications
      .map((app) => app.event.edition?.id)
      .filter((id): id is number => id != null)

    // Récupérer tous les créneaux assignés pour cet utilisateur dans ces éditions
    let volunteerAssignments = []
    if (editionIds.length > 0) {
      volunteerAssignments = await prisma.volunteerAssignment.findMany({
        where: {
          userId: user.id,
          timeSlot: {
            eventId: {
              in: editionIds,
            },
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
              eventId: true,
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

    // Traitement pour remplacer les IDs des équipes par leurs noms et ajouter les créneaux assignés
    const applicationsWithTeamNames = applications.map((app) => {
      const teamPreferencesWithNames = app.teamPreferences
        ? (app.teamPreferences as unknown as string[]).map((teamId) => {
            const team = app.event.volunteerTeams.find((t) => t.id === teamId)
            return team ? team.name : teamId
          })
        : []

      // Construire la liste des équipes assignées avec leurs noms depuis teamAssignments
      const assignedTeamsWithNames = app.teamAssignments
        ? app.teamAssignments.map((assignment) => assignment.team.name)
        : []

      // Filtrer les créneaux assignés pour cette édition
      const editionAssignments = volunteerAssignments.filter(
        (assignment) => assignment.timeSlot.eventId === app.event.edition?.id
      )

      // Reconstituer la forme historique de la réponse : `edition` à plat (sans event), avec la
      // config bénévole (askX) ré-aplatie depuis EventVolunteerSettings pour compat front.
      const { event: _event, ...appRest } = app
      const s = app.event.volunteerSettings
      return {
        ...appRest,
        teamPreferences: teamPreferencesWithNames,
        assignedTeams: assignedTeamsWithNames,
        assignedTimeSlots: editionAssignments,
        edition: app.event.edition
          ? {
              ...app.event.edition,
              volunteersAskDiet: s?.askDiet ?? false,
              volunteersAskAllergies: s?.askAllergies ?? false,
              volunteersAskEmergencyContact: s?.askEmergencyContact ?? false,
              volunteersAskTimePreferences: s?.askTimePreferences ?? false,
              volunteersAskTeamPreferences: s?.askTeamPreferences ?? false,
              volunteersAskPets: s?.askPets ?? false,
              volunteersAskMinors: s?.askMinors ?? false,
              volunteersAskVehicle: s?.askVehicle ?? false,
              volunteersAskCompanion: s?.askCompanion ?? false,
              volunteersAskAvoidList: s?.askAvoidList ?? false,
              volunteersAskSkills: s?.askSkills ?? false,
              volunteersAskExperience: s?.askExperience ?? false,
              volunteersAskSetup: s?.askSetup ?? false,
              volunteersAskTeardown: s?.askTeardown ?? false,
            }
          : null,
      }
    })

    return applicationsWithTeamNames
  },
  { operationName: 'GetUserVolunteerApplications' }
)
