import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: {
      id: true,
      volunteersOpen: true,
      volunteersDescription: true,
      volunteersMode: true,
      volunteersExternalUrl: true,
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
      volunteersAskEmergencyContact: true,
      volunteersSetupStartDate: true,
      volunteersTeardownEndDate: true,
      volunteersAskSetup: true,
      volunteersAskTeardown: true,
      volunteersUpdatedAt: true,
      volunteerApplications: { select: { id: true, status: true, userId: true } },
    },
  })
  if (!edition) throw createError({ statusCode: 404, message: 'Edition introuvable' })

  const counts = edition.volunteerApplications.reduce(
    (acc, a) => {
      acc.total++
      acc[a.status] = (acc[a.status] || 0) + 1
      return acc
    },
    { total: 0 } as any
  )

  return {
    open: edition.volunteersOpen,
    description: edition.volunteersDescription || null,
    mode: (edition as any).volunteersMode || 'INTERNAL',
    externalUrl: (edition as any).volunteersExternalUrl || null,
    askDiet: (edition as any).volunteersAskDiet || false,
    askAllergies: (edition as any).volunteersAskAllergies || false,
    askTimePreferences: (edition as any).volunteersAskTimePreferences || false,
    askTeamPreferences: (edition as any).volunteersAskTeamPreferences || false,
    askPets: (edition as any).volunteersAskPets || false,
    askMinors: (edition as any).volunteersAskMinors || false,
    askVehicle: (edition as any).volunteersAskVehicle || false,
    askCompanion: (edition as any).volunteersAskCompanion || false,
    askAvoidList: (edition as any).volunteersAskAvoidList || false,
    askSkills: (edition as any).volunteersAskSkills || false,
    askExperience: (edition as any).volunteersAskExperience || false,
    askEmergencyContact: (edition as any).volunteersAskEmergencyContact || false,
    setupStartDate: (edition as any).volunteersSetupStartDate || null,
    teardownEndDate: (edition as any).volunteersTeardownEndDate || null,
    askSetup: (edition as any).volunteersAskSetup || false,
    askTeardown: (edition as any).volunteersAskTeardown || false,
    updatedAt: (edition as any).volunteersUpdatedAt || null,
    counts,
  }
})
