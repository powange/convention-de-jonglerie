/**
 * Combien de places reste-t-il sur une offre&nbsp;?
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. Cette règle était recopiée **à l'identique** dans `OfferCard.vue`
 * et `OfferDetail.vue`, et le filtre « avec des places libres » en aurait écrit une troisième
 * copie. C'est exactement le motif que cet audit passe son temps à refermer : une règle appliquée
 * d'un seul côté. Trois copies, et la liste se met un jour à masquer une offre que sa fiche
 * annonce encore disponible — sans qu'aucune des trois soit « fausse ».
 *
 * Deux sources, dans cet ordre, et l'ordre est le fond du sujet :
 *
 * 1. **`remainingSeats` rendu par l'API**, quand il est là. `transformCarpoolOffer` le calcule sur
 *    la liste COMPLÈTE des réservations, alors que le `bookings` transmis au client est FILTRÉ
 *    selon qui regarde : un tiers ne voit que les `ACCEPTED`. Le chiffre du serveur est donc le
 *    seul qui compte des places prises plutôt que des réservations montrées.
 * 2. **le repli sur `bookings`**, pour les appelants qui passent une offre brute — une fiche
 *    construite à la main, un test. Il donne le même résultat tant que les `ACCEPTED` sont
 *    visibles, ce qui est le cas aujourd'hui pour tout le monde.
 *
 * `typeof === 'number'` et non une vérité simple : `0` est une valeur, et c'est précisément celle
 * d'une offre complète. Un `offre.remainingSeats || repli` aurait recalculé à partir des
 * réservations visibles au moment exact où le chiffre du serveur dit « plus aucune place » —
 * c'est-à-dire là où l'écart entre les deux sources compte le plus.
 */
export interface OffreAPlaces {
  availableSeats?: number | null
  remainingSeats?: number | null
  bookings?: { status?: string | null; seats?: number | null }[] | null
}

export function placesRestantes(offre: OffreAPlaces | null | undefined): number {
  if (!offre) return 0
  if (typeof offre.remainingSeats === 'number') return offre.remainingSeats

  const accordees = (offre.bookings ?? [])
    .filter((reservation) => reservation?.status === 'ACCEPTED')
    .reduce((total, reservation) => total + (reservation?.seats || 0), 0)

  return Math.max(0, (offre.availableSeats ?? 0) - accordees)
}
