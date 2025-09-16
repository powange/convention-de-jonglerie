import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    })
  }

  try {
    const applications = await prisma.editionVolunteerApplication.findMany({
      where: {
        userId: event.context.user.id,
      },
      select: {
        id: true,
        status: true,
        motivation: true,
        createdAt: true,
        dietaryPreference: true,
        allergies: true,
        timePreferences: true,
        teamPreferences: true,
        assignedTeams: true,
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
        edition: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            city: true,
            country: true,
            imageUrl: true,
            volunteersAskDiet: true,
            volunteersAskAllergies: true,
            volunteersAskTimePreferences: true,
            volunteersAskTeamPreferences: true,
            volunteersAskPets: true,
            volunteersAskMinors: true,
            volunteersAskVehicle: true,
            volunteersAskCompanion: true,
            volunteersAskAvoidList: true,
            volunteersAskSkills: true,
            volunteersAskExperience: true,
            volunteersAskSetup: true,
            volunteersAskTeardown: true,
            convention: {
              select: {
                id: true,
                name: true,
                logo: true,
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

    // Traitement pour remplacer les IDs des équipes par leurs noms
    const applicationsWithTeamNames = applications.map((app) => {
      const teamPreferencesWithNames = app.teamPreferences
        ? app.teamPreferences.map((teamId: any) => {
            const team = app.edition.volunteerTeams.find((t: any) => t.id === teamId)
            return team ? team.name : teamId
          })
        : []

      const assignedTeamsWithNames = app.assignedTeams
        ? app.assignedTeams.map((teamId: any) => {
            const team = app.edition.volunteerTeams.find((t: any) => t.id === teamId)
            return team ? team.name : teamId
          })
        : []

      return {
        ...app,
        teamPreferences: teamPreferencesWithNames,
        assignedTeams: assignedTeamsWithNames,
        edition: {
          ...app.edition,
          volunteerTeams: undefined, // On supprime cette propriété du retour
        },
      }
    })

    return applicationsWithTeamNames
  } catch (error) {
    console.error('Erreur lors de la récupération des candidatures:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur lors de la récupération des candidatures',
    })
  }
})
