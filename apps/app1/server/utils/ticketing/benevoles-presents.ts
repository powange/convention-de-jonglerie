/**
 * Quels bénévoles sont PRÉSENTS SUR PLACE — à l'événement, au montage ou au démontage.
 *
 * ⚠️ POURQUOI CET UTIL EXISTE, et ce qu'il répare. La règle « accepté ET présent pendant
 * l'événement » était recopiée QUATRE fois : trois dans `ticketing/stats.get.ts`, une dans
 * `ticketing/verify.post.ts`. Et elle MANQUAIT dans `my-tickets.get.ts`, qui émettait donc un
 * badge de bénévole pour toute candidature acceptée — y compris celle de quelqu'un qui a
 * explicitement dit ne pas être là pendant l'événement.
 *
 * Le résultat était un badge qui s'affiche dans « mes billets », avec son QR code, et que le
 * guichet REFUSE au moment de le scanner. Les deux surfaces répondaient à la même question et se
 * contredisaient : la personne se présente avec un billet que l'application lui a donné.
 *
 * ⚠️ `eventAvailability: null` EST INCLUS, et ce n'est pas de la tolérance : la colonne a été
 * ajoutée après coup, et les candidatures antérieures la portent à `null`. Les exclure retirerait
 * leur badge à des bénévoles historiques qui n'ont jamais eu l'occasion de répondre à la question.
 *
 * ⚠️ `false` est une VALEUR, pas une absence. C'est la distinction qui compte ici : `null` veut
 * dire « on ne lui a pas demandé », `false` veut dire « il a répondu non ». Un `OR` qui les
 * confondrait rouvrirait exactement le défaut.
 */

/**
 * Le fragment de `where` Prisma qui retient les bénévoles présents sur place.
 *
 * S'emploie par étalement, à côté des autres conditions :
 *
 *     where: { eventId: editionId, status: 'ACCEPTED', ...benevolePresentAEvenement() }
 *
 * ⚠️ Rendu par une FONCTION et non exporté comme constante : un objet partagé serait le même en
 * mémoire pour tous les appelants, et Prisma comme un `where` composé par étalement n'en font
 * rien de dangereux — mais une modification accidentelle sur place se propagerait partout. Une
 * fonction rend un objet neuf à chaque appel.
 */
export function benevolePresentSurPlace() {
  return {
    OR: [
      { eventAvailability: true },
      // Candidatures antérieures à l'ajout de la colonne : personne ne leur a posé la question.
      { eventAvailability: null },
      // ⚠️ LE MONTAGE ET LE DÉMONTAGE COMPTENT, et c'est la correction de ce lot. La règle ne
      // regardait que `eventAvailability` : un bénévole qui a répondu « non » à la présence
      // PENDANT l'événement mais « oui » au montage était introuvable au contrôle d'accès — par
      // son nom comme par son adresse. Signalé sur une édition où cinq bénévoles acceptés sont
      // dans ce cas, neuf toutes éditions confondues.
      //
      // Il est pourtant physiquement là, et il faut bien le faire entrer. Le `false` conserve son
      // sens : celui qui a répondu « non » aux TROIS questions reste écarté.
      { setupAvailability: true },
      { teardownAvailability: true },
    ],
  } as const
}

/**
 * Le `where` complet d'un bénévole ACCEPTÉ et présent sur place sur une édition.
 *
 * La forme la plus employée : les quatre recopies l'écrivaient toutes avec `eventId` et
 * `status: 'ACCEPTED'` autour du fragment.
 */
export function benevoleAccepteEtPresentSurPlace(editionId: number) {
  return {
    eventId: editionId,
    status: 'ACCEPTED' as const,
    ...benevolePresentSurPlace(),
  }
}
