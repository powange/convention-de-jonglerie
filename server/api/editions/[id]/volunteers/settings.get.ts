import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition introuvable',
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

    const counts = edition.volunteerApplications.reduce(
      (acc, a) => {
        acc.total++
        acc[a.status] = (acc[a.status] || 0) + 1
        return acc
      },
      { total: 0, PENDING: 0, ACCEPTED: 0, REJECTED: 0 } as Record<string, number>
    )

    return {
      open: edition.volunteersOpen,
      description: edition.volunteersDescription || null,
      mode: edition.volunteersMode || 'INTERNAL',
      externalUrl: edition.volunteersExternalUrl || null,
      askDiet: edition.volunteersAskDiet || false,
      askAllergies: edition.volunteersAskAllergies || false,
      askTimePreferences: edition.volunteersAskTimePreferences || false,
      askTeamPreferences: edition.volunteersAskTeamPreferences || false,
      askPets: edition.volunteersAskPets || false,
      askMinors: edition.volunteersAskMinors || false,
      askVehicle: edition.volunteersAskVehicle || false,
      askCompanion: edition.volunteersAskCompanion || false,
      askAvoidList: edition.volunteersAskAvoidList || false,
      askSkills: edition.volunteersAskSkills || false,
      askExperience: edition.volunteersAskExperience || false,
      askEmergencyContact: edition.volunteersAskEmergencyContact || false,
      setupStartDate: edition.volunteersSetupStartDate || null,
      teardownEndDate: edition.volunteersTeardownEndDate || null,
      askSetup: edition.volunteersAskSetup || false,
      askTeardown: edition.volunteersAskTeardown || false,
      updatedAt: edition.volunteersUpdatedAt || null,
      counts,
    }
  },
  { operationName: 'GetVolunteerSettings' }
)
