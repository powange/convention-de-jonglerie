/**
 * Ce qu'on peut encore faire d'une commande, selon qu'elle est déjà annulée ou non.
 *
 * Une commande annulée porte le statut `Refunded` — un nom hérité des prestataires de paiement,
 * qui parle de remboursement là où l'écran parle d'annulation. C'est déjà une raison suffisante
 * de ne pas laisser ce littéral se promener dans un composant.
 *
 * Il s'y promenait sept fois : le badge «&nbsp;Annulée&nbsp;», le libellé et l'icône du menu, le
 * titre de la modale, son message, le libellé de son bouton, et le message de succès. Sept
 * endroits pour une seule question, et sept occasions d'en oublier un — auquel cas l'écran
 * proposerait «&nbsp;annuler&nbsp;» une commande déjà annulée, ou annoncerait une suppression là
 * où il n'annule que.
 *
 * La distinction n'est pas cosmétique : sur une commande déjà annulée, le geste destructeur
 * devient une **suppression définitive**, billets compris. Se tromper de mot, c'est faire cliquer
 * quelqu'un sur ce qu'il croit être réversible.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Une commande, réduite à ce qui décide de son sort. */
export interface CommandeSupprimable {
  /** Statut du prestataire. `Refunded` signifie « annulée », pas « remboursée en argent ». */
  status?: string | null
  /** Présent quand la commande vient d'une billetterie externe. */
  externalTicketing?: unknown
}

/** Le geste destructeur possible sur une commande. */
export type GesteDestructeur = 'annuler' | 'supprimer'

/** Cette commande est-elle déjà annulée&nbsp;? */
export function commandeEstAnnulee(commande: CommandeSupprimable | null | undefined): boolean {
  return commande?.status === 'Refunded'
}

/**
 * Annuler, ou supprimer définitivement&nbsp;?
 *
 * Une commande déjà annulée ne peut plus qu'être supprimée : l'annuler une seconde fois ne
 * voudrait rien dire. C'est de là que découlent le libellé du menu, l'icône, le titre de la
 * modale, son message et son bouton — pour qu'ils ne puissent pas se contredire.
 */
export function gesteDestructeur(
  commande: CommandeSupprimable | null | undefined
): GesteDestructeur {
  return commandeEstAnnulee(commande) ? 'supprimer' : 'annuler'
}

/**
 * Peut-on agir sur cette commande&nbsp;?
 *
 * Non pour les commandes importées d'une billetterie externe : elles appartiennent au
 * prestataire, et les modifier ici ferait diverger les deux côtés sans que rien ne le signale.
 * La condition était écrite en creux dans le composant (`if (!order.externalTicketing)`), ce qui
 * marchait tant qu'on se souvenait de la poser.
 */
export function commandeModifiableIci(commande: CommandeSupprimable | null | undefined): boolean {
  return !!commande && !commande.externalTicketing
}
