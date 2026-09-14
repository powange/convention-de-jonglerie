import { peutEchangerSesCreneaux } from '~~/shared/utils/benevoles-volants'

/**
 * Refuse la requête si l'édition a fermé les échanges de créneaux.
 *
 * Le contrôle vit ici plutôt que dans chaque page : masquer un bouton n'empêche personne
 * d'appeler l'API. Sans ce garde, un bénévole pourrait continuer à proposer des échanges sur une
 * édition qui les a fermés, et un responsable les recevrait sans comprendre d'où ils sortent.
 */
export async function exigerEchangesOuverts(editionId: number) {
  const reglages = await prisma.eventVolunteerSettings.findUnique({
    where: { eventId: editionId },
    select: { swapsEnabled: true },
  })

  // Absence de réglages = édition qui n'a jamais rien configuré : le défaut reste ouvert, comme
  // partout ailleurs pour ce champ.
  if (reglages && !reglages.swapsEnabled) {
    throw createError({
      status: 403,
      message: 'Les échanges de créneaux sont fermés sur cette édition.',
      data: { code: 'SWAPS_DISABLED' },
    })
  }
}

/**
 * Refuse la requête si la personne est un bénévole VOLANT.
 *
 * Un volant est transparent vis-à-vis des échanges : il ne propose pas les créneaux qu'on lui a
 * confiés en renfort, et personne ne peut les lui demander. L'échange est un mécanisme entre gens
 * qui se doivent un volume de travail — un volant n'en doit aucun, donc il n'a ni charge à céder
 * ni charge à reprendre.
 *
 * Le contrôle vit au serveur et pas seulement à l'écran : masquer un bouton n'empêche personne
 * d'appeler l'API, et c'est la leçon que ce module a déjà tirée avec `visibilite-equipes`.
 */
export async function exigerEchangesPourCettePersonne(editionId: number, userId: number) {
  const equipes = await prisma.applicationTeamAssignment.findMany({
    where: { application: { userId, eventId: editionId, status: 'ACCEPTED' } },
    select: { team: { select: { isFloatingTeam: true } } },
  })

  if (!peutEchangerSesCreneaux(equipes.map((assignation) => assignation.team))) {
    throw createError({
      status: 403,
      message: 'Les créneaux de renfort des bénévoles volants ne s’échangent pas.',
      data: { code: 'SWAPS_FLOATING_VOLUNTEER' },
    })
  }
}
