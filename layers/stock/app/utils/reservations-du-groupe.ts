/**
 * Un groupe de stock gère-t-il les réservations&nbsp;?
 *
 * Tout le matériel ne se réserve pas. Un groupe « consommables » ou « décoration » n'a que faire
 * d'un calendrier et de quantités disponibles par période : la mécanique encombre l'écran d'une
 * complexité dont personne ne se sert, et elle fait douter — « ai-je oublié de réserver ces
 * gobelets&nbsp;? ».
 *
 * ⚠️ Le filtre est SERVEUR. C'est la leçon de `visibilite-equipes.ts` : là-bas, un réglage qui
 * promettait de cacher des équipes ne cachait qu'à l'affichage, l'API rendant tout. « Un réglage
 * qui promet de cacher et ne cache qu'à l'affichage est pire qu'un réglage absent : on s'en sert en
 * croyant qu'il protège. » Un `v-if` ne protège rien ; il rend seulement l'écran cohérent avec ce
 * que le serveur a déjà décidé.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Le groupe, réduit à ce dont la règle a besoin. */
export interface GroupeReservable {
  /**
   * Le réglage du groupe.
   *
   * `null` ou `undefined` — une réponse antérieure à ce réglage — vaut **désactivé** : le défaut du
   * schéma est `false`, et une absence ne doit pas ouvrir ce qu'un réglage fermerait.
   */
  reservationsEnabled?: boolean | null
}

/**
 * Les réservations sont-elles ouvertes sur ce groupe&nbsp;?
 *
 * C'est la seule question que posent les cinq surfaces concernées — quatre écritures et le
 * calendrier. Elles n'ont donc pas à connaître le réglage, ni à refaire le raisonnement chacune de
 * leur côté : c'est ainsi qu'une règle finit écrite cinq fois et appliquée trois.
 */
export function reservationsOuvertesSur(groupe: GroupeReservable | null | undefined): boolean {
  return groupe?.reservationsEnabled === true
}

/**
 * Le code d'erreur rendu quand les réservations sont fermées sur le groupe.
 *
 * Nommé, comme `SWAPS_DISABLED` pour les échanges : l'écran doit pouvoir distinguer « rien à
 * afficher » de « pas de réservation sur ce groupe » pour en dire la raison, sans comparer des
 * messages traduits.
 */
export const RESERVATIONS_FERMEES = 'GROUP_RESERVATIONS_DISABLED'

/**
 * Peut-on fermer les réservations de ce groupe&nbsp;?
 *
 * Non tant qu'il en reste, et c'est délibéré. Les masquer en les gardant en base laisserait des
 * gens compter sur du matériel réservé qui ne s'affiche plus nulle part, sans que rien ne le
 * signale — le pire des deux mondes. Le refus, lui, est visible et se répare.
 *
 * Même règle que la fermeture des échanges de créneaux, qui refuse tant qu'il reste des demandes à
 * trancher : on ne retire pas un écran sous les pieds de ceux qui l'attendent.
 *
 * Les réservations ANNULÉES ne comptent pas : elles ne promettent plus rien à personne.
 */
export function fermetureBloqueePar(reservationsActives: number): boolean {
  return reservationsActives > 0
}

/** Le code d'erreur du refus de fermeture, distinct de celui d'un accès refusé. */
export const FERMETURE_IMPOSSIBLE = 'GROUP_HAS_RESERVATIONS'
