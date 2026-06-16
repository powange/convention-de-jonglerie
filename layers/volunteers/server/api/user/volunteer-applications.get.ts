import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const applications = await prisma.editionVolunteerApplication.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        eventId: true,
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
        // Étape 0bis : données génériques de l'Event ; l'affichage propre au domaine (ville, image,
        // convention…) vient du port eventScope, pas d'une lecture d'Edition dans le layer.
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            volunteerSettings: true,
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

    // Étape 0bis : données d'affichage propres au domaine (ville, image, convention) via le port
    const allEventIds = [...new Set(applications.map((app) => app.eventId))]
    const displayData = await useVolunteerPorts().eventScope.getEventDisplayData(allEventIds)

    // Récupérer les événements des candidatures acceptées pour chercher les créneaux assignés
    const acceptedApplications = applications.filter((app) => app.status === 'ACCEPTED')
    const eventIds = acceptedApplications.map((app) => app.eventId)

    // Récupérer tous les créneaux assignés pour cet utilisateur dans ces événements
    let volunteerAssignments = []
    if (eventIds.length > 0) {
      volunteerAssignments = await prisma.volunteerAssignment.findMany({
        where: {
          userId: user.id,
          timeSlot: {
            eventId: {
              in: eventIds,
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

      // Filtrer les créneaux assignés pour cet événement
      const eventAssignments = volunteerAssignments.filter(
        (assignment) => assignment.timeSlot.eventId === app.eventId
      )

      // Reconstituer la forme historique de la réponse : `edition` à plat. Métadonnées génériques
      // depuis Event, affichage propre au domaine depuis le port, config bénévole (askX) depuis
      // EventVolunteerSettings. Front inchangé.
      const { event: _event, ...appRest } = app
      const s = app.event.volunteerSettings
      return {
        ...appRest,
        teamPreferences: teamPreferencesWithNames,
        assignedTeams: assignedTeamsWithNames,
        assignedTimeSlots: eventAssignments,
        edition: {
          // Affichage propre au domaine (port) en premier : les champs génériques (id/name/dates)
          // et la config bénévole ci-dessous priment sur d'éventuelles clés homonymes du port.
          ...(displayData[app.eventId] ?? {}),
          id: app.eventId,
          name: app.event.name,
          startDate: app.event.startDate,
          endDate: app.event.endDate,
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
        },
      }
    })

    return applicationsWithTeamNames
  },
  { operationName: 'GetUserVolunteerApplications' }
)
