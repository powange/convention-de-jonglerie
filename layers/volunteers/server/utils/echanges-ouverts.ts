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
