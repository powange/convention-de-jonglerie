/**
 * Quelle somme le guichet annonce-t-il, et laquelle le bouton va-t-il solder ?
 *
 * ⚠️ UNE QUESTION DE PRÉCÉDENCE, ET ELLE A DÉJÀ ÉCHOUÉ EN SILENCE. Trois dettes peuvent se
 * présenter sur un même billet, et l'écran n'en montre qu'une :
 *
 * 1. une **remise** accordée et pas encore rendue, sur un billet vivant ;
 * 2. la dette de toute la **commande**, quand ses lignes annulées reviennent à la même personne ;
 * 3. la dette de ce **billet** seul.
 *
 * Le défaut : `detteDeCommande` rend TOUJOURS un objet, total nul compris, si bien que le cas 2
 * l'emportait dès qu'un billet était affiché. On retombait sur un total de commande à zéro, qui ne
 * s'annonce pas, et l'encadré ne s'affichait jamais pour une remise — alors que le serveur
 * annonçait bien la dette. Aucune erreur, aucun message : simplement rien à l'écran, et une
 * personne qui repart sans son argent.
 */

export interface DettesDuBillet {
  /** La dette vient-elle d'une remise accordée et pas encore rendue ? */
  estUneRemise: boolean
  /** Ce que doit ce billet seul, rendu par le serveur. `null` : rien. */
  dueParLeBillet: number | null
  /** La commande se solde-t-elle d'un seul geste ? Faux dès que ses lignes ont plusieurs noms. */
  soldeToutLaCommande: boolean
  /** Ce que doit la commande entière. Nul quand aucune de ses lignes n'est due. */
  dueParLaCommande: number
}

/**
 * La somme à annoncer, ou `null` quand il n'y a rien à rendre.
 *
 * ⚠️ LA REMISE PASSE EN PREMIER. Elle porte sur CE billet, et la dette de commande ne la contient
 * pas : ce geste-là n'écrit que sur les lignes annulées. Laisser la commande l'emporter masque la
 * remise ; l'ajouter au total de la commande annoncerait une somme qu'un seul clic ne solderait
 * pas — on rendrait l'argent sans que la dette disparaisse, et on la rendrait encore le lendemain.
 *
 * 📍 Zéro n'est pas une dette : l'annoncer ferait ouvrir la caisse pour rien.
 */
export function sommeDueAuGuichet(dettes: DettesDuBillet): number | null {
  if (dettes.estUneRemise) return dettes.dueParLeBillet

  if (dettes.soldeToutLaCommande) {
    return dettes.dueParLaCommande > 0 ? dettes.dueParLaCommande : null
  }

  return dettes.dueParLeBillet
}
