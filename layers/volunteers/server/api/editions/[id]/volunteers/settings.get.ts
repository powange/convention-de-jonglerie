import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Étape 0bis : la config bénévole vit dans EventVolunteerSettings (porté par Event).
    const eventRecord = await fetchResourceOrFail(prisma.event, editionId, {
      errorMessage: 'Édition introuvable',
      select: {
        volunteerSettings: true,
        volunteerApplications: { select: { id: true, status: true, userId: true } },
      },
    })

    const s = eventRecord.volunteerSettings

    const counts = eventRecord.volunteerApplications.reduce(
      (acc, a) => {
        acc.total++
        acc[a.status] = (acc[a.status] || 0) + 1
        return acc
      },
      { total: 0, PENDING: 0, ACCEPTED: 0, REJECTED: 0 } as Record<string, number>
    )

    return {
      pagePublic: s?.pagePublic ?? false,
      open: s?.open ?? false,
      description: s?.description ?? null,
      mode: s?.mode ?? 'INTERNAL',
      externalUrl: s?.externalUrl ?? null,
      askDiet: s?.askDiet ?? false,
      askAllergies: s?.askAllergies ?? false,
      askTimePreferences: s?.askTimePreferences ?? false,
      askTeamPreferences: s?.askTeamPreferences ?? false,
      askPets: s?.askPets ?? false,
      askMinors: s?.askMinors ?? false,
      askVehicle: s?.askVehicle ?? false,
      askCompanion: s?.askCompanion ?? false,
      askAvoidList: s?.askAvoidList ?? false,
      askSkills: s?.askSkills ?? false,
      askExperience: s?.askExperience ?? false,
      askEmergencyContact: s?.askEmergencyContact ?? false,
      setupStartDate: s?.setupStartDate ?? null,
      teardownEndDate: s?.teardownEndDate ?? null,
      askSetup: s?.askSetup ?? false,
      askTeardown: s?.askTeardown ?? false,
      updatedAt: s?.updatedAt ?? null,
      counts,
    }
  },
  { operationName: 'GetVolunteerSettings' }
)
