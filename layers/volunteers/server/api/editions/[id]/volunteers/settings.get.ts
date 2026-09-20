import { droitsSurLaConfiguration } from '../../../../utils/acces-configuration-benevoles'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { optionalAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'
import { visibiliteDuBenevolat } from '#server/utils/visibilite-benevoles'
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

    /**
     * Étape 0bis : la config bénévole vit dans EventVolunteerSettings (porté par Event).
     *
     * Appelé directement plutôt que par `fetchResourceOrFail` : ce helper infère son type du
     * modèle et non du `select`, si bien que les champs demandés n'existent pas pour TypeScript.
     * Le coût était déjà payé ici avant l'ajout de `edition` — l'écrire ainsi le rend.
     */
    const eventRecord = await prisma.event.findUnique({
      where: { id: editionId },
      select: { volunteerSettings: true, edition: { select: { endDate: true } } },
    })
    if (!eventRecord) throw createError({ status: 404, message: 'Édition introuvable' })

    const s = eventRecord.volunteerSettings

    /**
     * Une édition dont le démontage est fini ne recrute plus et n'expose plus sa page.
     *
     * La règle est appliquée AVANT le contrôle d'accès, et c'est le point : `pagePublic` est
     * l'une des trois portes de `droitsSurLaConfiguration`. La refermer ici fait disparaître la
     * configuration pour un simple visiteur — un gestionnaire et un ancien candidat gardent la
     * leur, par les deux autres portes.
     */
    const benevolat = visibiliteDuBenevolat({
      open: s?.open ?? false,
      pagePublic: s?.pagePublic ?? false,
      finDemontage: s?.teardownEndDate,
      finEdition: eventRecord.edition?.endDate,
      maintenant: new Date(),
    })

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
      pagePublic: benevolat.pagePublic,
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
      pagePublic: benevolat.pagePublic,
      open: benevolat.open,
      // Dérivé, pas stocké : il dit à l'écran de gestion POURQUOI les deux drapeaux ci-dessus
      // sont retombés, sans quoi l'organisateur d'une édition passée se retrouve devant deux
      // interrupteurs qui reviennent seuls à leur place.
      volunteeringEnded: benevolat.terminee,
      description: s?.description ?? null,
      mode: s?.mode ?? 'INTERNAL',
      swapsEnabled: s?.swapsEnabled ?? true,
      organizersInTeams: s?.organizersInTeams ?? false,
      // Lisible par un bénévole ayant candidaté, et c'est voulu : la page publique en a besoin
      // pour expliquer une absence de planning au lieu de la laisser passer pour un bug.
      planningPublished: s?.planningPublished ?? false,
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
      // Les réglages de l'assignation automatique ne sortent que pour un gestionnaire : ils
      // disent quelles contraintes pèsent sur la répartition, ce qu'un bénévole n'a pas à
      // connaître — et cet endpoint, lui, est aussi lisible par qui a simplement candidaté.
      ...(estGestionnaire ? { autoAssignConstraints: s?.autoAssignConstraints ?? null } : {}),
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
