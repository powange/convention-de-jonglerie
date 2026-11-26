/**
 * Le repas que le comptoir peut servir.
 *
 * Les points d'API du comptoir vérifiaient chacun que le repas appartenait bien à l'édition, mais
 * aucun qu'il était encore ACTIVÉ. Or un organisateur qui décoche un repas dit à la cuisine de ne
 * pas le préparer : le servir et le compter quand même produit un « dîner du jeudi » qui n'existe
 * pas, avec sa barre de progression et ses totaux.
 *
 * Quatre d'entre eux appellent cette garde — la validation, la recherche, les non-validés et les
 * statistiques : ceux qui servent un repas ou le comptent. Le cinquième, l'annulation, s'en écarte
 * délibérément (voir plus bas).
 *
 * Le défaut ne se voyait pas côté bénévoles et artistes — la désactivation supprime leurs
 * sélections, ils disparaissaient donc des listes. Il ne se voyait que pour les organisateurs, dont
 * le droit est implicite et sans ligne, et pour les billets, rattachés au tarif : ceux-là restaient
 * servables. C'est cette moitié silencieuse que la garde ferme.
 *
 * Pourquoi un util partagé et non `enabled: true` recopié dans chaque fichier : « quel repas le
 * comptoir peut-il servir » est UNE règle. Recopiée, elle finit par diverger d'un point d'API à
 * l'autre, et c'est exactement ainsi que la question s'est posée ici — `participants.get.ts` et
 * `duplicates.get.ts` filtraient déjà `enabled`, les cinq autres non.
 *
 * ⚠️ `cancel.post.ts` ne l'appelle VOLONTAIREMENT pas, et le dit sur place : annuler ne sert aucun
 * repas, et l'interdire piégerait une consommation saisie par erreur avant la désactivation.
 */
export async function assurerRepasServiAuComptoir(
  mealId: number,
  editionId: number
): Promise<void> {
  const repas = await prisma.volunteerMeal.findFirst({
    where: { id: mealId, editionId },
    select: { enabled: true },
  })

  if (!repas) {
    throw createError({
      status: 404,
      message: 'Repas non trouvé',
    })
  }

  /*
   * 400 et non 404, avec un message qui nomme la cause : le repas existe, et la personne au
   * comptoir a le plus souvent un onglet ouvert d'avant la désactivation. « Repas non trouvé »
   * l'enverrait chercher une erreur d'adressage là où il s'agit d'un réglage.
   */
  if (!repas.enabled) {
    throw createError({
      status: 400,
      message: 'Ce repas est désactivé',
    })
  }
}
