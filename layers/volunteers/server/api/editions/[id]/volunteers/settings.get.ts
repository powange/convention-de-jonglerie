import { droitsSurLaConfiguration } from '../../../../utils/acces-configuration-benevoles'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { optionalAuth } from '#server/utils/auth-utils'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

/**
 * GET .../volunteers/settings — la configuration bénévole d'une édition.
 *
 * Cet endpoint n'avait aucun contrôle : il rendait la configuration complète *et* le décompte des
 * candidatures à tout compte connecté, y compris sur une édition dont la page de bénévolat n'est
 * pas publique. La page publique, elle, était bien gardée — la porte était sur l'écran, pas sur la
 * donnée.
 *
 * Qui a droit à quoi se décide dans `droitsSurLaConfiguration`, à côté de ses tests. Ici on se
 * contente de rassembler la situation et d'obéir.
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const user = optionalAuth(event)

    // Étape 0bis : la config bénévole vit dans EventVolunteerSettings (porté par Event).
    const eventRecord = await fetchResourceOrFail(prisma.event, editionId, {
      errorMessage: 'Édition introuvable',
      select: { volunteerSettings: true },
    })

    const s = eventRecord.volunteerSettings

    const estGestionnaire = user
      ? await useVolunteerPorts().organizers.canManage(editionId, user.id, event)
      : false

    // Quel que soit son statut : l'écran « mes candidatures » a besoin des questions posées pour
    // rendre lisibles les réponses que la personne a elle-même données.
    const aUneCandidature = user
      ? (await prisma.editionVolunteerApplication.findFirst({
          where: { eventId: editionId, userId: user.id },
          select: { id: true },
        })) !== null
      : false

    const droits = droitsSurLaConfiguration({
      pagePublic: s?.pagePublic ?? false,
      estGestionnaire,
      aUneCandidature,
    })

    if (!droits.reglages) {
      // 404 et non 403, comme la FAQ : sur une édition dont la page n'est pas publique, un 403
      // confirmerait qu'il y a quelque chose à voir.
      throw createError({ status: 404, message: 'Configuration bénévole non disponible' })
    }

    // Comptés en base plutôt que rapatriés puis réduits : quatre nombres ne valent pas une ligne
    // par candidat. Et pas comptés du tout quand personne n'a le droit de les lire.
    const counts = droits.compteurs ? await compterLesCandidatures(editionId) : undefined

    return {
      pagePublic: s?.pagePublic ?? false,
      open: s?.open ?? false,
      description: s?.description ?? null,
      mode: s?.mode ?? 'INTERNAL',
      swapsEnabled: s?.swapsEnabled ?? true,
      organizersInTeams: s?.organizersInTeams ?? false,
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
      // La clé est omise plutôt que remplie de zéros : un zéro se lirait « personne n'a postulé ».
      ...(counts ? { counts } : {}),
    }
  },
  { operationName: 'GetVolunteerSettings' }
)

/** Le décompte par statut, les quatre clés toujours présentes — un statut absent vaut zéro. */
async function compterLesCandidatures(editionId: number) {
  const groupes = await prisma.editionVolunteerApplication.groupBy({
    by: ['status'],
    where: { eventId: editionId },
    _count: { _all: true },
  })

  const counts: Record<string, number> = { total: 0, PENDING: 0, ACCEPTED: 0, REJECTED: 0 }

  for (const groupe of groupes) {
    const nombre = groupe._count._all
    counts[groupe.status] = (counts[groupe.status] ?? 0) + nombre
    counts.total! += nombre
  }

  return counts
}
