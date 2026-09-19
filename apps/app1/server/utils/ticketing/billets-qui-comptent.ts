/**
 * « Quels billets comptent ? » — posée une fois, pour que deux écrans ne répondent plus
 * différemment.
 *
 * Les deux points d'API de statistiques comptaient les mêmes entrées validées et n'étaient pas
 * d'accord : `stats.get.ts` écartait les lignes annulées et les commandes remboursées,
 * `stats/validations.get.ts` ne filtrait rien du tout. Sur l'édition 1, cela faisait deux
 * validations d'écart entre deux écrans voisins — sans que ni l'un ni l'autre ne soit
 * manifestement faux, puisque aucun des deux ne disait sa règle.
 *
 * ## Le vocabulaire réel, et non celui que le code supposait
 *
 * Deux colonnes portent un état, et ce sont des chaînes libres — ni énumération Prisma, ni
 * constante. Relevé sur une copie des données de production :
 *
 * - `TicketingOrderItem.state` : `Processed` (879), `Pending` (25), **`Canceled` (12)**.
 * - `TicketingOrder.status` : `Processed` (361), `Onsite` (180), `Pending` (22),
 *   **`Refunded` (2)**.
 *
 * ⚠️ Les deux vocabulaires ne se recouvrent pas : **aucune ligne n'est `Refunded`** et **aucune
 * commande n'est `Canceled`**. Les commentaires d'origine annonçaient « exclure les billets
 * remboursés » là où le filtre excluait en réalité les billets *annulés* — d'où ce fichier, qui
 * dit ce que le filtre fait plutôt que ce qu'on croyait qu'il faisait.
 *
 * ⚠️ `Onsite` est un statut de **commande**, jamais un état de ligne : une vente au guichet porte
 * `status: 'Onsite'` et `state: 'Processed'`. L'exclure ici retirerait toutes les ventes sur
 * place, qui sont un tiers des commandes.
 *
 * ## La garde d'entrée, refermée depuis
 *
 * Ce fichier ne couvrait d'abord que les **lectures de statistiques**, et signalait que la garde
 * de `validate-entry.post.ts` refusait `state: 'Refunded'` — une valeur qu'aucune ligne ne porte —
 * et laissait donc valider un billet annulé. C'était exact : **4 billets `Canceled` de la
 * production portaient un code QR valide et une commande `Processed`**, donc se scannaient et se
 * validaient comme des billets ordinaires. `billetAnnule` ci-dessous est la réponse, et la garde
 * s'en sert désormais.
 */

/** Les états de ligne qui valent « ce billet existe toujours ». */
export const ETATS_DE_BILLET_COMPTABILISES = ['Processed', 'Pending'] as const

/** Le seul statut de commande qui annule ce qu'elle contient. */
export const STATUT_COMMANDE_REMBOURSEE = 'Refunded'

/**
 * Le fragment de `where` qui sélectionne les billets d'une édition qui comptent.
 *
 * Rendu par une fonction et non exposé en constante : les deux conditions vivent à des niveaux
 * différents du `where` (la ligne et sa commande), et une constante obligerait chaque appelant à
 * fusionner `order` à la main — c'est-à-dire à pouvoir l'oublier.
 */
export function billetsQuiComptent(editionId: number) {
  return {
    state: { in: [...ETATS_DE_BILLET_COMPTABILISES] },
    order: {
      editionId,
      status: { not: STATUT_COMMANDE_REMBOURSEE },
    },
  }
}

/**
 * « Ce billet compte-t-il comme un participant ? »
 *
 * Le drapeau vit sur le tarif — et 47 billets n'ont pas de tarif du tout : des billets importés
 * qu'aucun tarif n'a rapprochés, et de la marchandise vendue au comptoir. Tester
 * `countAsParticipant: false` les manquait donc autant que tester `true` : ils ne tombaient dans
 * aucun des deux groupes et disparaissaient des graphiques, tout en étant validés au guichet.
 *
 * Un billet sans tarif n'est pas un participant : il rejoint « autres ».
 */
export const estUnParticipant = { tier: { countAsParticipant: true } }

export const nEstPasUnParticipant = {
  OR: [{ tier: { countAsParticipant: false } }, { tierId: null }],
}

/**
 * Les états de ligne qui retirent le droit d'entrer.
 *
 * Une **liste explicite**, et non le complément de `ETATS_DE_BILLET_COMPTABILISES` : `state` est
 * une chaîne libre, et si le fournisseur invente demain une valeur, la traiter d'office comme une
 * annulation refuserait un billet légitime **à la porte**, devant la file. Laisser entrer
 * quelqu'un dont l'état est inconnu est la moindre des deux erreurs ; c'est le seul endroit du
 * module où le doute penche de ce côté.
 *
 * `Refunded` n'apparaît sur aucune ligne aujourd'hui — il est conservé parce que la garde
 * d'origine le visait, et qu'aucune trace ne dit s'il a existé.
 */
export const ETATS_DE_BILLET_ANNULE = ['Canceled', 'Refunded'] as const

/**
 * Le fragment de `where` qui désigne un billet qui **ne donne plus droit d'entrée**.
 *
 * Deux façons de l'être, qui ne se recouvrent pas : la ligne est annulée, ou la commande entière
 * a été remboursée. La garde d'origine ne connaissait que la seconde et une valeur inexistante
 * pour la première.
 */
export function billetAnnule() {
  return {
    OR: [
      { state: { in: [...ETATS_DE_BILLET_ANNULE] } },
      { order: { status: STATUT_COMMANDE_REMBOURSEE } },
    ],
  }
}
